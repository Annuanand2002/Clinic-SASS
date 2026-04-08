import { Component, Input } from '@angular/core';

/** Thin alias over {@link InventoryTableComponent} for report pages. */
@Component({
  selector: 'app-report-table',
  template: `
    <app-inventory-table
      [columns]="columns"
      [rows]="rows"
      [loading]="loading"
      [emptyMessage]="emptyMessage"
      [loadingMessage]="loadingMessage"
    ></app-inventory-table>
  `
})
export class ReportTableComponent {
  @Input() columns: Array<{ key: string; label: string }> = [];
  @Input() rows: Record<string, unknown>[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No data.';
  @Input() loadingMessage = 'Loading…';
}
