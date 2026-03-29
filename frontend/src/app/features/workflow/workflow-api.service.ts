import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AdminWorkflowRow,
  EntityWorkflowState,
  WorkflowGraphResponse
} from './workflow.models';

@Injectable({ providedIn: 'root' })
export class WorkflowApiService {
  private readonly base = `${environment.apiUrl.replace(/\/$/, '')}/api/workflow`;

  constructor(private readonly http: HttpClient) {}

  listAdminWorkflows(entityType?: string): Observable<AdminWorkflowRow[]> {
    let params = new HttpParams();
    if (entityType) params = params.set('entityType', entityType);
    return this.http
      .get<{ workflows: AdminWorkflowRow[] }>(`${this.base}/admin/workflows`, { params })
      .pipe(map((r) => r.workflows || []));
  }

  createAdminWorkflow(body: {
    name: string;
    entityType: string;
  }): Observable<AdminWorkflowRow> {
    return this.http.post<AdminWorkflowRow>(`${this.base}/admin/workflows`, body);
  }

  patchAdminWorkflow(
    id: number,
    body: { name?: string; isActive?: boolean }
  ): Observable<AdminWorkflowRow> {
    return this.http.patch<AdminWorkflowRow>(`${this.base}/admin/workflows/${id}`, body);
  }

  getWorkflowGraph(id: number): Observable<WorkflowGraphResponse> {
    return this.http.get<WorkflowGraphResponse>(`${this.base}/admin/workflows/${id}/graph`);
  }

  saveWorkflowGraph(
    id: number,
    body: {
      nodes: Array<{
        id: number;
        name: string | null;
        label: string | null;
        nodeType: string;
        config: Record<string, unknown> | null;
        positionX: number;
        positionY: number;
      }>;
      edges: Array<{
        fromNodeId: number;
        toNodeId: number;
        conditionJson: Record<string, unknown> | null;
      }>;
    }
  ): Observable<WorkflowGraphResponse> {
    return this.http.put<WorkflowGraphResponse>(`${this.base}/admin/workflows/${id}/graph`, body);
  }

  getEntityWorkflowState(
    entityType: string,
    entityId: number,
    historyLimit?: number
  ): Observable<EntityWorkflowState> {
    let params = new HttpParams();
    if (historyLimit != null) params = params.set('historyLimit', String(historyLimit));
    return this.http.get<EntityWorkflowState>(
      `${this.base}/entities/${encodeURIComponent(entityType)}/${entityId}`,
      { params }
    );
  }

  transitionEntity(
    entityType: string,
    entityId: number,
    body: { toNodeId: number; message?: string | null }
  ): Observable<EntityWorkflowState & { message?: string }> {
    return this.http.post<EntityWorkflowState & { message?: string }>(
      `${this.base}/entities/${encodeURIComponent(entityType)}/${entityId}/transition`,
      body
    );
  }
}
