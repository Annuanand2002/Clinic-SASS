import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../mobile-core/dashboard.service';
import { DashboardSummary } from '../../mobile-core/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  loading = false;
  greetingName = '';
  summary: DashboardSummary = {
    patients: 0,
    appointments: 0,
    totalIncome: 0,
    balance: 0,
    pendingComplaints: 0
  };

  constructor(private readonly dashboard: DashboardService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.dashboard.loadSummary().subscribe({
      next: (res) => {
        this.greetingName = res.greetingName || 'there';
        this.summary = res.summary;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
