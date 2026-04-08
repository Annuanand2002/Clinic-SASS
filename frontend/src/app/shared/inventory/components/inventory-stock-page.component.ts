import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { InventoryApiService } from '../inventory-api.service';
import { ToastService } from '../../../core/ui/toast.service';
import { AuthSessionService, SELECTED_CLINIC_ALL } from '../../../features/auth/application/auth-session.service';
import { InventoryBatchRowDto } from '../inventory.models';

@Component({
  selector: 'app-inventory-stock-page',
  templateUrl: './inventory-stock-page.component.html',
  styleUrls: ['./inventory-stock-page.component.css']
})
export class InventoryStockPageComponent implements OnInit {
  @HostBinding('class.inventory-shell-host') readonly inventoryShellHost = true;

  @Input() canEdit = true;

  batches: InventoryBatchRowDto[] = [];
  itemOptions: Array<{ id: number; name: string }> = [];
  filterItemId: number | null = null;
  loading = false;

  purchaseForm = {
    itemId: null as number | null,
    quantity: 1,
    batchNumber: '',
    purchasePrice: null as number | null,
    expiryDate: '',
    purchaseDate: '',
    supplierName: ''
  };
  purchaseSubmitting = false;
  purchaseError = '';

  constructor(
    private readonly inv: InventoryApiService,
    private readonly toast: ToastService,
    private readonly authSession: AuthSessionService
  ) {}

  ngOnInit(): void {
    this.loadItemOptions();
    this.loadBatches();
  }

  loadItemOptions(): void {
    this.inv.listItems({ page: 1, limit: 500 }).subscribe({
      next: (res) => {
        this.itemOptions = (res.items || []).filter((i) => i.isActive).map((i) => ({ id: i.id, name: i.name }));
      },
      error: () => (this.itemOptions = [])
    });
  }

  loadBatches(): void {
    this.loading = true;
    this.inv
      .listBatchesReport({
        mode: 'all',
        itemId: this.filterItemId || undefined
      })
      .subscribe({
        next: (r) => {
          this.batches = r.batches || [];
          this.loading = false;
        },
        error: () => {
          this.batches = [];
          this.loading = false;
          this.toast.error('Could not load batches.');
        }
      });
  }

  onFilterChange(): void {
    this.loadBatches();
  }

  statusFor(row: InventoryBatchRowDto): 'expired' | 'expiring' | 'safe' {
    if (!row.expiryDate) return 'safe';
    const t0 = this.today();
    const e = this.parseDate(row.expiryDate);
    if (e < t0) return 'expired';
    const diff = (e.getTime() - t0.getTime()) / 86400000;
    if (diff >= 0 && diff <= 7) return 'expiring';
    return 'safe';
  }

  private today(): Date {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  private parseDate(s: string): Date {
    const p = s.slice(0, 10).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  submitPurchase(): void {
    if (!this.canEdit) return;
    if (this.authSession.getElevatedClinicSelection() === SELECTED_CLINIC_ALL) {
      this.toast.error('Select a single clinic to add stock.');
      return;
    }
    const itemId = this.purchaseForm.itemId;
    const qty = Math.floor(Number(this.purchaseForm.quantity) || 0);
    if (!itemId || qty < 1) {
      this.purchaseError = 'Select an item and a valid quantity.';
      return;
    }
    this.purchaseSubmitting = true;
    this.purchaseError = '';
    this.inv
      .purchaseStock({
        itemId,
        quantity: qty,
        batchNumber: this.purchaseForm.batchNumber || null,
        purchasePrice: this.purchaseForm.purchasePrice,
        expiryDate: this.purchaseForm.expiryDate || null,
        purchaseDate: this.purchaseForm.purchaseDate || null,
        supplierName: this.purchaseForm.supplierName || null
      })
      .subscribe({
        next: () => {
          this.purchaseSubmitting = false;
          this.toast.success('Stock added.');
          this.purchaseForm = {
            itemId: null,
            quantity: 1,
            batchNumber: '',
            purchasePrice: null,
            expiryDate: '',
            purchaseDate: '',
            supplierName: ''
          };
          this.loadBatches();
        },
        error: (err) => {
          this.purchaseSubmitting = false;
          this.purchaseError = err?.error?.message || 'Could not add stock.';
          this.toast.error(this.purchaseError);
        }
      });
  }
}
