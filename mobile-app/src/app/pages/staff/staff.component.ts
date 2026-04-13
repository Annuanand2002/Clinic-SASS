import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../mobile-core/dashboard.service';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.scss'
})
export class StaffComponent {
  rows: Array<{ id?: number; username?: string; staffType?: string; department?: string }> = [];

  constructor(private readonly dashboard: DashboardService) {}

  ngOnInit(): void {
    this.dashboard.loadStaff().subscribe((rows) => (this.rows = rows));
  }
}
