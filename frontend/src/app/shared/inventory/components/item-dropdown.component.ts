import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-item-dropdown',
  template: `
    <div class="item-dd">
      <input
        type="text"
        class="item-dd-search"
        [(ngModel)]="search"
        (ngModelChange)="onSearchChange()"
        [placeholder]="searchPlaceholder"
        [disabled]="disabled"
      />
      <select
        class="item-dd-select"
        [ngModel]="value"
        (ngModelChange)="onSelect($event)"
        [disabled]="disabled"
      >
        <option [ngValue]="null">{{ placeholder }}</option>
        <option *ngFor="let o of filteredItems" [ngValue]="o.id">{{ o.name }}</option>
      </select>
    </div>
  `,
  styles: [
    `
      .item-dd {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .item-dd-search,
      .item-dd-select {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(255, 255, 255, 0.9);
        color: inherit;
        font-size: 14px;
      }
      .item-dd-search:focus,
      .item-dd-select:focus {
        outline: none;
        border-color: rgba(79, 70, 229, 0.55);
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
      }
    `
  ]
})
export class ItemDropdownComponent implements OnChanges {
  @Input() items: Array<{ id: number; name: string }> = [];
  @Input() value: number | null = null;
  @Input() placeholder = 'Select item';
  @Input() searchPlaceholder = 'Search items…';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<number | null>();

  search = '';
  filteredItems: Array<{ id: number; name: string }> = [];

  ngOnChanges(_c: SimpleChanges): void {
    this.applyFilter();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  onSelect(id: number | null): void {
    this.value = id;
    this.valueChange.emit(id);
  }

  private applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    if (!q) {
      this.filteredItems = [...this.items];
      return;
    }
    this.filteredItems = this.items.filter((i) => i.name.toLowerCase().includes(q));
  }
}
