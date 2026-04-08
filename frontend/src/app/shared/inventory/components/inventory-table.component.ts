import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-inventory-table',
  template: `
    <div class="table-wrap" *ngIf="!loading; else loadingTpl">
      <table class="register-table inventory-table">
        <thead>
          <tr>
            <th *ngFor="let c of columns">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td *ngFor="let c of columns">{{ cell(row, c.key) }}</td>
          </tr>
          <tr *ngIf="rows.length === 0">
            <td [attr.colspan]="columns.length || 1" class="muted empty-cell">{{ emptyMessage }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #loadingTpl>
      <p class="muted loading-line">{{ loadingMessage }}</p>
    </ng-template>
  `,
  styles: [
    `
      .empty-cell {
        text-align: center;
        padding: 18px;
      }
      .loading-line {
        padding: 16px;
      }
    `
  ]
})
export class InventoryTableComponent {
  @Input() columns: Array<{ key: string; label: string }> = [];
  @Input() rows: Record<string, unknown>[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No rows.';
  @Input() loadingMessage = 'Loading…';

  cell(row: Record<string, unknown>, key: string): string {
    const v = row[key];
    if (v == null) return '—';
    return String(v);
  }
}
