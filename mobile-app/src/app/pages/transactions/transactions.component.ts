import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../mobile-core/dashboard.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss'
})
export class TransactionsComponent {
  rows: Array<{ id?: number; date?: string; type?: string; category?: string; amount?: number }> = [];

  constructor(private readonly dashboard: DashboardService) {}

  ngOnInit(): void {
    this.dashboard.loadTransactions().subscribe((rows) => (this.rows = rows));
  }
}
