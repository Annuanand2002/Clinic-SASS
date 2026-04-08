import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InventoryBatchRowDto,
  InventoryItemAvailabilityDto,
  InventoryItemDto,
  InventoryMetaDto,
  InventorySummaryRow
} from './inventory.models';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly base = `${environment.apiUrl}/api/inventory`;

  constructor(private readonly http: HttpClient) {}

  getMeta(): Observable<InventoryMetaDto> {
    return this.http.get<InventoryMetaDto>(`${this.base}/meta`);
  }

  getItemAvailability(itemId: number): Observable<InventoryItemAvailabilityDto> {
    return this.http.get<InventoryItemAvailabilityDto>(`${this.base}/items/${itemId}/availability`);
  }

  listItems(params: {
    page?: number;
    limit?: number;
    q?: string;
    category?: string;
  }): Observable<{ items: InventoryItemDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    let hp = new HttpParams();
    if (params.page != null) hp = hp.set('page', String(params.page));
    if (params.limit != null) hp = hp.set('limit', String(params.limit));
    if (params.q) hp = hp.set('q', params.q);
    if (params.category) hp = hp.set('category', params.category);
    return this.http.get<{ items: InventoryItemDto[]; pagination: any }>(`${this.base}/items`, { params: hp });
  }

  createItem(body: Record<string, unknown>): Observable<{ item: InventoryItemDto }> {
    return this.http.post<{ item: InventoryItemDto }>(`${this.base}/items`, body);
  }

  updateItem(id: number, body: Record<string, unknown>): Observable<{ item: InventoryItemDto & { totalQuantity?: number } }> {
    return this.http.put<{ item: InventoryItemDto & { totalQuantity?: number } }>(`${this.base}/items/${id}`, body);
  }

  deleteItem(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/items/${id}`);
  }

  purchaseStock(body: Record<string, unknown>): Observable<{ message: string; stockId: number; itemId: number; quantity: number }> {
    return this.http.post<{ message: string; stockId: number; itemId: number; quantity: number }>(`${this.base}/purchase`, body);
  }

  getSummary(expiringWithinDays?: number): Observable<{
    items: InventorySummaryRow[];
    lowStockItems: InventorySummaryRow[];
    expiringBatches: Array<{
      stockId: number;
      itemId: number;
      itemName: string;
      quantity: number;
      batchNumber: string;
      expiryDate: string | null;
      purchaseDate: string | null;
    }>;
    expiringWithinDays: number;
  }> {
    let hp = new HttpParams();
    if (expiringWithinDays != null) hp = hp.set('expiringWithinDays', String(expiringWithinDays));
    return this.http.get<{
      items: InventorySummaryRow[];
      lowStockItems: InventorySummaryRow[];
      expiringBatches: Array<{
        stockId: number;
        itemId: number;
        itemName: string;
        quantity: number;
        batchNumber: string;
        expiryDate: string | null;
        purchaseDate: string | null;
      }>;
      expiringWithinDays: number;
    }>(`${this.base}/summary`, { params: hp });
  }

  listBatchesReport(query: {
    mode: 'all' | 'expiring' | 'expired';
    itemId?: number | null;
    fromDate?: string;
    toDate?: string;
  }): Observable<{ batches: InventoryBatchRowDto[] }> {
    let hp = new HttpParams().set('mode', query.mode);
    if (query.itemId) hp = hp.set('itemId', String(query.itemId));
    if (query.fromDate) hp = hp.set('fromDate', query.fromDate);
    if (query.toDate) hp = hp.set('toDate', query.toDate);
    return this.http.get<{ batches: InventoryBatchRowDto[] }>(`${this.base}/batches-report`, { params: hp });
  }
}
