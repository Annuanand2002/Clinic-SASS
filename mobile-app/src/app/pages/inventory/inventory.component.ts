import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../mobile-core/dashboard.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss'
})
export class InventoryComponent {
  rows: Array<{ id?: number; name?: string; category?: string; totalQuantity?: number }> = [];

  constructor(private readonly dashboard: DashboardService) {}

  ngOnInit(): void {
    this.dashboard.loadInventory().subscribe((rows) => (this.rows = rows));
  }
}
