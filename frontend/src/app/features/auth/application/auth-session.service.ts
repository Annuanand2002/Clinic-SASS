import { Injectable } from '@angular/core';
import { LoginResponse } from '../domain/models/login-response';
import { isJwtExpired } from '../../../core/auth/jwt.utils';

const STORAGE_KEY = 'dentalclinic_auth';

const ELEVATED_ROLES = ['Super Admin', 'Admin'] as const;
const CLINIC_BOUND_ROLES = ['Staff', 'Doctor'] as const;

/** Stored in localStorage for elevated users to request org-wide read scope */
export const SELECTED_CLINIC_ALL = 'all' as const;

export type ElevatedClinicSelection = number | typeof SELECTED_CLINIC_ALL;

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private selectedClinicStorageKey(userId: number): string {
    return `dentalclinic_selected_clinic_${userId}`;
  }

  private isElevatedRole(role: string | null | undefined): boolean {
    return !!role && (ELEVATED_ROLES as readonly string[]).includes(role);
  }

  private isClinicBoundRole(role: string | null | undefined): boolean {
    return !!role && (CLINIC_BOUND_ROLES as readonly string[]).includes(role);
  }

  setSession(auth: LoginResponse): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: auth.token,
        user: auth.user
      })
    );
    this.ensureDefaultSelectedClinic();
  }

  patchUser(partial: Partial<LoginResponse['user']>): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { token: string; user: LoginResponse['user'] };
      parsed.user = { ...parsed.user, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      /* ignore */
    }
    this.ensureDefaultSelectedClinic();
  }

  /**
   * After login or /me patch: persist a valid selected clinic for Super Admin / Admin.
   */
  ensureDefaultSelectedClinic(): void {
    const user = this.getUser();
    if (!user?.id) return;
    if (this.isClinicBoundRole(user.role)) return;
    if (!this.isElevatedRole(user.role)) return;
    const clinics = user.clinics || [];
    const key = this.selectedClinicStorageKey(user.id);
    const savedRaw = localStorage.getItem(key);

    if (savedRaw === SELECTED_CLINIC_ALL) {
      if (clinics.length) return;
      localStorage.removeItem(key);
      return;
    }

    const savedId = savedRaw ? Number(savedRaw) : NaN;
    const valid = Number.isFinite(savedId) && clinics.some((c) => c.id === savedId);
    if (valid) return;
    if (clinics.length) {
      localStorage.setItem(key, String(clinics[0].id));
    } else {
      localStorage.removeItem(key);
    }
  }

  /** Elevated: current dropdown value. Bound: not used. */
  getElevatedClinicSelection(): ElevatedClinicSelection | null {
    const user = this.getUser();
    if (!user?.id || !this.isElevatedRole(user.role)) return null;
    const key = this.selectedClinicStorageKey(user.id);
    const raw = localStorage.getItem(key);
    if (raw === SELECTED_CLINIC_ALL) return SELECTED_CLINIC_ALL;
    const n = raw ? Number(raw) : NaN;
    const clinics = user.clinics || [];
    if (Number.isFinite(n) && clinics.some((c) => c.id === n)) return n;
    if (clinics[0]) return clinics[0].id;
    return null;
  }

  /** True when elevated user chose “All clinics” (combined read scope). */
  isAllClinicsScopeSelected(): boolean {
    return this.getElevatedClinicSelection() === SELECTED_CLINIC_ALL;
  }

  /**
   * Numeric clinic for UI that requires a single site (e.g. labels). Null when “all” or unknown.
   */
  getSelectedClinicId(): number | null {
    const user = this.getUser();
    if (!user?.id) return null;
    if (this.isClinicBoundRole(user.role)) {
      return user.clinicId != null ? Number(user.clinicId) : null;
    }
    if (!this.isElevatedRole(user.role)) return null;
    const sel = this.getElevatedClinicSelection();
    if (sel === SELECTED_CLINIC_ALL || sel == null) return null;
    return sel;
  }

  setSelectedClinic(value: ElevatedClinicSelection): void {
    const user = this.getUser();
    if (!user?.id || !this.isElevatedRole(user.role)) return;
    const clinics = user.clinics || [];
    if (value === SELECTED_CLINIC_ALL) {
      if (!clinics.length) return;
      localStorage.setItem(this.selectedClinicStorageKey(user.id), SELECTED_CLINIC_ALL);
      return;
    }
    if (!clinics.some((c) => c.id === value)) return;
    localStorage.setItem(this.selectedClinicStorageKey(user.id), String(value));
  }

  /**
   * Value for X-Clinic-Id: numeric id, or "all" for org-wide reads (elevated only).
   * Bound roles send their home clinic id only.
   */
  getClinicIdHeaderValue(): string | null {
    const user = this.getUser();
    if (!user) return null;
    if (this.isClinicBoundRole(user.role)) {
      return user.clinicId != null ? String(user.clinicId) : null;
    }
    if (!this.isElevatedRole(user.role)) return null;
    const sel = this.getElevatedClinicSelection();
    if (sel == null) return null;
    if (sel === SELECTED_CLINIC_ALL) return SELECTED_CLINIC_ALL;
    return String(sel);
  }

  /** @deprecated use getClinicIdHeaderValue */
  getEffectiveClinicIdForApi(): number | null {
    const h = this.getClinicIdHeaderValue();
    if (h == null || h === SELECTED_CLINIC_ALL) return null;
    const n = Number(h);
    return Number.isFinite(n) ? n : null;
  }

  getToken(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const token = (JSON.parse(raw) as { token: string }).token;
      if (token && isJwtExpired(token)) {
        this.clear();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  getUser(): LoginResponse['user'] | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { user: LoginResponse['user'] }).user;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
