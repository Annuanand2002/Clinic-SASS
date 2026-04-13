import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../mobile-env/environment';
import { DashboardSummary } from './models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  loadSummary() {
    return forkJoin({
      me: this.http.get<{ auth?: { username?: string } }>(`${environment.apiUrl}/api/auth/me`).pipe(catchError(() => of({ auth: { username: '' } }))),
      patients: this.http.get<{ pagination?: { total?: number } }>(`${environment.apiUrl}/api/patients`, { params: { page: 1, limit: 1 } }).pipe(catchError(() => of({ pagination: { total: 0 } }))),
      appointments: this.http.get<{ pagination?: { total?: number } }>(`${environment.apiUrl}/api/appointments`, { params: { page: 1, limit: 1 } }).pipe(catchError(() => of({ pagination: { total: 0 } }))),
      financial: this.http.get<{ totalIncome?: number; balance?: number }>(`${environment.apiUrl}/api/financial/dashboard`).pipe(catchError(() => of({ totalIncome: 0, balance: 0 }))),
      complaints: this.http.get<{ complaints?: Array<{ status?: string }> }>(`${environment.apiUrl}/api/complaints`, { params: { page: 1, limit: 100 } }).pipe(catchError(() => of({ complaints: [] })))
    }).pipe(
      map((res) => {
        const openStates = new Set(['open', 'new', 'pending', 'in progress', 'assigned']);
        const pendingComplaints = (res.complaints.complaints || []).filter((c) => openStates.has(String(c.status || '').toLowerCase())).length;
        return {
          greetingName: res.me.auth?.username || '',
          summary: {
            patients: Number(res.patients.pagination?.total || 0),
            appointments: Number(res.appointments.pagination?.total || 0),
            totalIncome: Number(res.financial.totalIncome || 0),
            balance: Number(res.financial.balance || 0),
            pendingComplaints
          } satisfies DashboardSummary
        };
      })
    );
  }

  loadTransactions() {
    return this.http.get<{ entries?: Array<{ id?: number; date?: string; type?: string; category?: string; amount?: number }> }>(`${environment.apiUrl}/api/financial/ledger`, { params: { page: 1, limit: 50 } }).pipe(map((res) => res.entries || []), catchError(() => of([])));
  }

  loadInventory() {
    return this.http.get<{ items?: Array<{ id?: number; name?: string; category?: string; totalQuantity?: number }> }>(`${environment.apiUrl}/api/inventory/items`, { params: { page: 1, limit: 50 } }).pipe(map((res) => res.items || []), catchError(() => of([])));
  }

  loadStaff() {
    return this.http.get<{ staff?: Array<{ id?: number; username?: string; staffType?: string; department?: string }> }>(`${environment.apiUrl}/api/staff`, { params: { page: 1, limit: 50 } }).pipe(map((res) => res.staff || []), catchError(() => of([])));
  }
}
