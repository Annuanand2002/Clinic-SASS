import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { InventoryApiService } from '../inventory-api.service';
import { ToastService } from '../../../core/ui/toast.service';
import { AuthSessionService, SELECTED_CLINIC_ALL } from '../../../features/auth/application/auth-session.service';
import { InventoryCategory, InventoryItemDto, InventoryMetaDto } from '../inventory.models';

@Component({
  selector: 'app-inventory-items-page',
  templateUrl: './inventory-items-page.component.html',
  styleUrls: ['./inventory-items-page.component.css']
})
export class InventoryItemsPageComponent implements OnInit {
  @HostBinding('class.inventory-shell-host') readonly inventoryShellHost = true;

  @Input() canEdit = true;

  meta: InventoryMetaDto | null = null;
  items: InventoryItemDto[] = [];
  pagination = { page: 1, limit: 12, total: 0, totalPages: 1 };
  pageInput = 1;
  search = '';
  categoryFilter: '' | InventoryCategory = '';
  loading = false;

  formOpen = false;
  editingId: number | null = null;
  formError = '';
  submitting = false;
  form: {
    name: string;
    category: InventoryCategory;
    unit: string;
    minStock: number;
    description: string;
    isActive: boolean;
  } = this.emptyForm();

  /** When set, applies to form.unit on change */
  unitPreset = '';

  constructor(
    private readonly inv: InventoryApiService,
    private readonly toast: ToastService,
    private readonly authSession: AuthSessionService
  ) {}

  ngOnInit(): void {
    this.inv.getMeta().subscribe({
      next: (m) => (this.meta = m),
      error: () => (this.meta = null)
    });
    this.load(1);
  }

  emptyForm() {
    return {
      name: '',
      category: 'consumable' as InventoryCategory,
      unit: '',
      minStock: 0,
      description: '',
      isActive: true
    };
  }

  load(page: number): void {
    this.loading = true;
    this.inv
      .listItems({
        page,
        limit: this.pagination.limit,
        q: this.search.trim(),
        category: this.categoryFilter || undefined
      })
      .subscribe({
        next: (res) => {
          this.items = res.items || [];
          const pg = res.pagination;
          this.pagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.pagination.limit,
            total: pg?.total ?? 0,
            totalPages: pg?.totalPages || 1
          };
          this.pageInput = this.pagination.page;
          this.loading = false;
        },
        error: () => {
          this.items = [];
          this.loading = false;
          this.toast.error('Could not load inventory items.');
        }
      });
  }

  onSearchInput(): void {
    this.load(1);
  }

  onCategoryChange(): void {
    this.load(1);
  }

  changePage(dir: 'prev' | 'next'): void {
    const n = dir === 'next' ? this.pagination.page + 1 : this.pagination.page - 1;
    if (n < 1 || n > this.pagination.totalPages) return;
    this.load(n);
  }

  jumpPage(): void {
    const t = Math.max(1, Math.min(this.pagination.totalPages, Number(this.pageInput) || 1));
    this.load(t);
  }

  openCreate(): void {
    if (!this.canEdit) return;
    if (this.authSession.getElevatedClinicSelection() === SELECTED_CLINIC_ALL) {
      this.toast.error('Select a single clinic to create items.');
      return;
    }
    this.editingId = null;
    this.form = this.emptyForm();
    this.unitPreset = '';
    this.formError = '';
    this.formOpen = true;
  }

  openEdit(row: InventoryItemDto): void {
    if (!this.canEdit) return;
    this.editingId = row.id;
    const u = row.unit || '';
    this.form = {
      name: row.name,
      category: row.category,
      unit: u,
      minStock: row.minStock,
      description: row.description || '',
      isActive: row.isActive
    };
    const preset = this.meta?.units?.some((x) => x.value === u);
    this.unitPreset = preset ? u : '';
    this.formError = '';
    this.formOpen = true;
  }

  onUnitPresetChange(): void {
    if (this.unitPreset) {
      this.form.unit = this.unitPreset;
    }
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
    this.submitting = false;
    this.formError = '';
  }

  save(): void {
    if (!this.canEdit) return;
    if (this.unitPreset) {
      this.form.unit = this.unitPreset;
    }
    const name = this.form.name.trim();
    if (!name) {
      this.formError = 'Name is required.';
      return;
    }
    if (this.editingId === null && this.authSession.getElevatedClinicSelection() === SELECTED_CLINIC_ALL) {
      this.toast.error('Select a single clinic to create items.');
      return;
    }
    const payload = {
      name,
      category: this.form.category,
      unit: this.form.unit.trim() || null,
      minStock: this.form.minStock,
      description: this.form.description.trim() || null,
      isActive: this.form.isActive
    };
    this.submitting = true;
    this.formError = '';
    const req =
      this.editingId != null
        ? this.inv.updateItem(this.editingId, payload)
        : this.inv.createItem(payload);
    req.subscribe({
      next: () => {
        this.submitting = false;
        this.toast.success(this.editingId != null ? 'Item updated.' : 'Item created.');
        this.closeForm();
        this.load(this.pagination.page);
      },
      error: (err) => {
        this.submitting = false;
        this.formError = err?.error?.message || 'Save failed.';
        this.toast.error(this.formError);
      }
    });
  }

  remove(row: InventoryItemDto): void {
    if (!this.canEdit) return;
    if (!window.confirm(`Delete item “${row.name}”?`)) return;
    this.inv.deleteItem(row.id).subscribe({
      next: () => {
        this.toast.success('Item deleted.');
        this.load(this.pagination.page);
      },
      error: (err) => this.toast.error(err?.error?.message || 'Delete failed.')
    });
  }

  statusLabel(row: InventoryItemDto): string {
    return row.isActive ? 'Active' : 'Inactive';
  }
}
