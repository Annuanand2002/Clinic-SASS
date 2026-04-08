import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BillLinePayload } from './inventory.models';

export interface CreateBillPayload {
  patientId: number;
  appointmentId?: number | null;
  billDate: string;
  discount: number;
  items: BillLinePayload[];
}

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly base = `${environment.apiUrl}/api/financial`;

  constructor(private readonly http: HttpClient) {}

  createBill(body: CreateBillPayload): Observable<{ message: string; billId: number }> {
    return this.http.post<{ message: string; billId: number }>(`${this.base}/bills`, body);
  }
}
