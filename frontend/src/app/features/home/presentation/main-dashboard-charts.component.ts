import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexMarkers,
  ApexTheme,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';

export interface MainDashboardFinanceChart {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  pendingPayments: number;
  chart: Array<{ month: string; income: number; expense: number; net: number }>;
  incomeByPaymentMethod: Array<{ method: string; amount: number }>;
  expenseByCategory: Array<{ category: string; amount: number }>;
  period?: { fromDate: string; toDate: string };
}

const PURPLE = '#7c3aed';
const CYAN = '#22d3ee';
const LAVENDER = '#e9d5ff';
const LAVENDER_DEEP = '#c4b5fd';

@Component({
  standalone: true,
  selector: 'app-main-dashboard-charts',
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './main-dashboard-charts.component.html',
  styleUrls: ['./main-dashboard-charts.component.css']
})
export class MainDashboardChartsComponent implements OnChanges {
  @Input() loading = false;
  @Input() finance: MainDashboardFinanceChart | null = null;
  @Input() periodLabel = '';

  donutSeries: ApexNonAxisChartSeries = [0, 0];
  donutChart: ApexChart = { type: 'donut', height: 260, fontFamily: 'inherit', toolbar: { show: false } };
  donutLabels: string[] = ['Income', 'Expense'];
  donutColors: string[] = [PURPLE, CYAN];
  donutPlotOptions: ApexPlotOptions = {};
  donutDataLabels: ApexDataLabels = { enabled: false };
  donutLegend: ApexLegend = { show: false };
  donutTooltip: ApexTooltip = {};
  donutStroke: ApexStroke = { lineCap: 'round' };

  barSeries: ApexAxisChartSeries = [];
  barChart: ApexChart = { type: 'bar', height: 280, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } };
  barPlotOptions: ApexPlotOptions = {};
  barDataLabels: ApexDataLabels = { enabled: false };
  barXaxis: ApexXAxis = {};
  barYaxis: ApexYAxis = {};
  barGrid: ApexGrid = {};
  barColors: string[] = [];
  barTooltip: ApexTooltip = {};
  barTheme: ApexTheme = { mode: 'light' };

  areaSeries: ApexAxisChartSeries = [];
  areaChart: ApexChart = { type: 'area', height: 300, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } };
  areaStroke: ApexStroke = { curve: 'smooth', width: 2 };
  areaFill: ApexFill = {};
  areaXaxis: ApexXAxis = {};
  areaYaxis: ApexYAxis = {};
  areaGrid: ApexGrid = {};
  areaColors: string[] = [PURPLE, CYAN];
  areaTooltip: ApexTooltip = {};
  areaLegend: ApexLegend = {};
  areaMarkers: ApexMarkers = { size: 4, strokeWidth: 2, strokeColors: '#fff', hover: { size: 6 } };

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['finance'] || ch['loading']) {
      this.rebuild();
    }
  }

  get hasChartRows(): boolean {
    return !!this.finance?.chart?.length;
  }

  formatMoney(n: number): string {
    return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private rebuild(): void {
    const f = this.finance;
    if (!f || this.loading) {
      this.resetPlaceholders();
      return;
    }

    const inc = Math.max(0, Number(f.totalIncome) || 0);
    const exp = Math.max(0, Number(f.totalExpense) || 0);
    const vol = inc + exp;
    const donutTotalLabel = vol > 0 ? this.formatMoney(vol) : '—';

    this.donutSeries = vol > 0 ? [inc, exp] : [1];
    this.donutLabels = vol > 0 ? ['Income', 'Expense'] : ['No data'];
    this.donutColors = vol > 0 ? [PURPLE, CYAN] : ['#e5e7eb'];
    this.donutPlotOptions = {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: { show: false },
            value: { show: false },
            total: {
              show: true,
              showAlways: true,
              label: 'Total flow',
              fontSize: '11px',
              fontWeight: 500,
              color: '#64748b',
              formatter: () => donutTotalLabel
            }
          }
        },
        expandOnClick: false
      }
    };
    this.donutTooltip = {
      y: {
        formatter: (val: number) => this.formatMoney(val)
      }
    };
    this.donutStroke = { lineCap: 'round' };

    const rows = f.chart || [];
    const categories = rows.map((r) => r.month);
    const incomeData = rows.map((r) => Number(r.income) || 0);
    const expenseData = rows.map((r) => Number(r.expense) || 0);

    const maxIdx = incomeData.length
      ? incomeData.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0)
      : -1;

    this.barSeries = [{ name: 'Income', data: incomeData }];
    this.barChart = {
      type: 'bar',
      height: 280,
      fontFamily: 'inherit',
      toolbar: { show: false },
      zoom: { enabled: false }
    };
    this.barPlotOptions = {
      bar: {
        borderRadius: 10,
        borderRadiusApplication: 'end',
        columnWidth: '58%',
        distributed: true,
        dataLabels: { position: 'top' }
      }
    };
    this.barColors = incomeData.map((_, i) => (i === maxIdx ? PURPLE : i % 2 === 0 ? LAVENDER : LAVENDER_DEEP));
    this.barXaxis = {
      categories,
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    };
    const barMax = Math.max(1, ...incomeData, ...expenseData);
    this.barYaxis = {
      min: 0,
      max: barMax,
      tickAmount: 4,
      labels: {
        style: { colors: '#64748b', fontSize: '11px' },
        formatter: (v: number) => String(Math.round(Number(v) || 0))
      }
    };
    this.barGrid = { borderColor: '#f1f5f9', strokeDashArray: 4, padding: { top: 8, right: 8, bottom: 0, left: 8 } };
    this.barTooltip = {
      shared: false,
      intersect: true,
      y: { formatter: (val: number) => this.formatMoney(val) }
    };

    const incomeSum = incomeData.reduce((a, b) => a + b, 0);
    const expenseSum = expenseData.reduce((a, b) => a + b, 0);

    this.areaSeries = [
      { name: 'Income', data: incomeData },
      { name: 'Expense', data: expenseData }
    ];
    this.areaFill = {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.42,
        opacityTo: 0.02,
        stops: [0, 92, 100]
      }
    };
    this.areaXaxis = {
      categories,
      crosshairs: {
        show: true,
        position: 'front',
        stroke: { color: PURPLE, width: 1, dashArray: 4 }
      },
      labels: { style: { colors: '#64748b', fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    };
    const areaPeak = Math.max(1, ...incomeData, ...expenseData);
    this.areaYaxis = {
      min: 0,
      max: areaPeak,
      tickAmount: 4,
      labels: {
        style: { colors: '#64748b', fontSize: '11px' },
        formatter: (v: number) => String(Math.round(Number(v) || 0))
      }
    };
    this.areaGrid = { borderColor: '#f1f5f9', strokeDashArray: 4, padding: { top: 12, right: 12, bottom: 4, left: 8 } };
    this.areaTooltip = {
      shared: true,
      intersect: false,
      x: { show: true },
      y: { formatter: (val: number) => this.formatMoney(val) }
    };
    this.areaLegend = {
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '12px',
      markers: { width: 10, height: 10, radius: 10, strokeWidth: 2, strokeColor: '#fff' },
      formatter: (name: string, opts: any) => {
        const idx = opts?.seriesIndex ?? 0;
        const totals = opts?.w?.globals?.seriesTotals as number[] | undefined;
        const total = totals && totals[idx] != null ? totals[idx] : idx === 0 ? incomeSum : expenseSum;
        return `${name}  ${this.formatMoney(Number(total) || 0)}`;
      }
    };
  }

  private resetPlaceholders(): void {
    this.donutSeries = [1];
    this.donutLabels = ['—'];
    this.donutColors = ['#e5e7eb'];
  }
}
