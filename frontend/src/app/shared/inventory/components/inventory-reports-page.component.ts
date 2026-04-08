import { Component, HostBinding, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { InventoryApiService } from '../inventory-api.service';
import { ToastService } from '../../../core/ui/toast.service';
import { InventoryBatchRowDto, InventorySummaryRow } from '../inventory.models';

export type InventoryReportMode = 'expiring' | 'expired' | 'low';

@Component({
  selector: 'app-inventory-reports-page',
  templateUrl: './inventory-reports-page.component.html',
  styleUrls: ['./inventory-reports-page.component.css']
})
export class InventoryReportsPageComponent implements OnInit, OnChanges {
  @HostBinding('class.inventory-shell-host') readonly inventoryShellHost = true;

  @Input() mode: InventoryReportMode = 'expiring';

  loading = false;
  itemOptions: Array<{ id: number; name: string }> = [];
  filterItemId: number | null = null;
  fromDate = '';
  toDate = '';

  batchRows: InventoryBatchRowDto[] = [];
  lowRows: InventorySummaryRow[] = [];

  reportColumns: Array<{ key: string; label: string }> = [];
  reportData: Record<string, unknown>[] = [];

  constructor(
    private readonly inv: InventoryApiService,
    private readonly toast: ToastService
  ) {}

  ngOnInit(): void {
    this.inv.listItems({ page: 1, limit: 500 }).subscribe({
      next: (r) => {
        this.itemOptions = (r.items || []).map((i) => ({ id: i.id, name: i.name }));
      },
      error: () => (this.itemOptions = [])
    });
    this.load();
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['mode'] && !ch['mode'].firstChange) {
      this.load();
    }
  }

  title(): string {
    switch (this.mode) {
      case 'expired':
        return 'Expired items (batches)';
      case 'low':
        return 'Low stock items';
      default:
        return 'Expiring soon (7 days)';
    }
  }

  load(): void {
    this.loading = true;
    if (this.mode === 'low') {
      this.reportColumns = [
        { key: 'name', label: 'Item' },
        { key: 'category', label: 'Category' },
        { key: 'unit', label: 'Unit' },
        { key: 'minStock', label: 'Min stock' },
        { key: 'totalQuantity', label: 'Available' }
      ];
      this.inv.getSummary(30).subscribe({
        next: (res) => {
          let rows = res.lowStockItems || [];
          if (this.filterItemId) {
            rows = rows.filter((r) => r.itemId === this.filterItemId);
          }
          this.lowRows = rows;
          this.reportData = rows.map((r) => ({
            name: r.name,
            category: r.category,
            unit: r.unit || '—',
            minStock: String(r.minStock),
            totalQuantity: String(r.totalQuantity)
          }));
          this.loading = false;
        },
        error: () => {
          this.reportData = [];
          this.loading = false;
          this.toast.error('Could not load low stock report.');
        }
      });
      return;
    }

    this.reportColumns = [
      { key: 'itemName', label: 'Item' },
      { key: 'batchNumber', label: 'Batch' },
      { key: 'remainingQuantity', label: 'Remaining' },
      { key: 'purchaseDate', label: 'Purchase' },
      { key: 'expiryDate', label: 'Expiry' }
    ];
    const apiMode = this.mode === 'expired' ? 'expired' : 'expiring';
    this.inv
      .listBatchesReport({
        mode: apiMode,
        itemId: this.filterItemId || undefined,
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined
      })
      .subscribe({
        next: (r) => {
          this.batchRows = r.batches || [];
          this.reportData = this.batchRows.map((b) => ({
            itemName: b.itemName,
            batchNumber: b.batchNumber || '—',
            remainingQuantity: String(b.remainingQuantity),
            purchaseDate: b.purchaseDate || '—',
            expiryDate: b.expiryDate || '—'
          }));
          this.loading = false;
        },
        error: () => {
          this.reportData = [];
          this.loading = false;
          this.toast.error('Could not load report.');
        }
      });
  }
}
