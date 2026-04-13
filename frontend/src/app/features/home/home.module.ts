import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './presentation/home.component';
import { StockStatusBadgeComponent } from '../../shared/inventory/components/stock-status-badge.component';
import { ItemDropdownComponent } from '../../shared/inventory/components/item-dropdown.component';
import { InventoryTableComponent } from '../../shared/inventory/components/inventory-table.component';
import { ReportTableComponent } from '../../shared/inventory/components/report-table.component';
import { InventoryItemsPageComponent } from '../../shared/inventory/components/inventory-items-page.component';
import { InventoryStockPageComponent } from '../../shared/inventory/components/inventory-stock-page.component';
import { InventoryReportsPageComponent } from '../../shared/inventory/components/inventory-reports-page.component';
import { MainDashboardChartsComponent } from './presentation/main-dashboard-charts.component';

@NgModule({
  declarations: [
    HomeComponent,
    StockStatusBadgeComponent,
    ItemDropdownComponent,
    InventoryTableComponent,
    ReportTableComponent,
    InventoryItemsPageComponent,
    InventoryStockPageComponent,
    InventoryReportsPageComponent
  ],
  imports: [CommonModule, FormsModule, HomeRoutingModule, MainDashboardChartsComponent]
})
export class HomeModule {}

