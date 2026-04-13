import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../mobile-env/environment';
import { AuthSession, LoginResponse } from './models';

const SESSION_KEY = 'mobile_auth_session';
const ALLOWED_ROLES = ['Super Admin', 'Admin'];
const SELECTED_CLINIC_ALL = 'all';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session$ = new BehaviorSubject<AuthSession | null>(this.readSession());

  constructor(private readonly http: HttpClient) {
    this.ensureDefaultClinicSelection();
  }

  login(usernameOrEmail: string, password: string): Observable<AuthSession> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { usernameOrEmail, password })
      .pipe(
        map((res) => {
          const role = res?.user?.role || '';
          if (!ALLOWED_ROLES.includes(role)) throw new Error('Only Super Admin and Admin can login to mobile app.');
          return { token: res.token, user: res.user };
        }),
        tap((session) => this.writeSession(session)),
        switchMap(() => this.refreshAuthContext()),
        map(() => this.session$.value as AuthSession)
      );
  }

  refreshAuthContext(): Observable<void> {
    if (!this.token) return of(void 0);
    return this.http
      .get<{ user: { organizationId: number | null; clinicId: number | null; role: string | null; clinics: Array<{ id: number; name: string }> | null; } | null; }>(`${environment.apiUrl}/api/auth/me`)
      .pipe(
        tap((res) => {
          if (!res?.user) return;
          this.patchUser(res.user);
        }),
        map(() => void 0),
        catchError(() => of(void 0))
      );
  }

  logout(): void {
    const userId = this.currentSession?.user?.id;
    localStorage.removeItem(SESSION_KEY);
    if (userId) localStorage.removeItem(this.selectedClinicStorageKey(userId));
    this.session$.next(null);
  }

  get token(): string | null { return this.currentSession?.token || null; }
  get currentSession(): AuthSession | null { return this.session$.value; }
  isAuthenticated(): boolean { return !!this.token; }

  get clinicOptions(): Array<{ id: number; name: string }> {
    return (this.currentSession?.user?.clinics || []).map((c) => ({ id: c.id, name: c.name || `Clinic #${c.id}` }));
  }

  getClinicHeaderValue(): string | null {
    const session = this.currentSession;
    if (!session?.user?.id) return null;
    const key = this.selectedClinicStorageKey(session.user.id);
    const selected = localStorage.getItem(key);
    if (selected === SELECTED_CLINIC_ALL) return SELECTED_CLINIC_ALL;
    const selectedId = selected ? Number(selected) : NaN;
    if (Number.isFinite(selectedId) && this.clinicOptions.some((c) => c.id === selectedId)) return String(selectedId);
    const firstClinic = this.clinicOptions[0]?.id;
    return firstClinic ? String(firstClinic) : SELECTED_CLINIC_ALL;
  }

  setClinicSelection(value: string): void {
    const userId = this.currentSession?.user?.id;
    if (!userId) return;
    const key = this.selectedClinicStorageKey(userId);
    const normalized = String(value || '').trim();
    if (normalized === SELECTED_CLINIC_ALL && this.clinicOptions.length) {
      localStorage.setItem(key, SELECTED_CLINIC_ALL);
      return;
    }
    const id = Number(normalized);
    if (!Number.isFinite(id) || !this.clinicOptions.some((c) => c.id === id)) return;
    localStorage.setItem(key, String(id));
  }

  private writeSession(session: AuthSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session$.next(session);
    this.ensureDefaultClinicSelection();
  }

  private readSession(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed?.token || !parsed?.user) return null;
      if (!ALLOWED_ROLES.includes(parsed.user.role || '')) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private patchUser(partial: Partial<LoginResponse['user']>): void {
    const current = this.currentSession;
    if (!current) return;
    const updated: AuthSession = { token: current.token, user: { ...current.user, ...partial } };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    this.session$.next(updated);
    this.ensureDefaultClinicSelection();
  }

  private ensureDefaultClinicSelection(): void {
    const userId = this.currentSession?.user?.id;
    if (!userId) return;
    const key = this.selectedClinicStorageKey(userId);
    const selected = localStorage.getItem(key);
    if (selected && (selected === SELECTED_CLINIC_ALL || this.clinicOptions.some((c) => c.id === Number(selected)))) return;
    const first = this.clinicOptions[0]?.id;
    if (first) localStorage.setItem(key, String(first));
  }

  private selectedClinicStorageKey(userId: number): string {
    return `mobile_selected_clinic_${userId}`;
  }
}
