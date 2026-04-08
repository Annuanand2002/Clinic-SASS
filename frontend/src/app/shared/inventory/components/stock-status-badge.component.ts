import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stock-status-badge',
  template: `<span class="stock-badge" [ngClass]="kind">{{ label }}</span>`,
  styles: [
    `
      .stock-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 11px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border: 1px solid transparent;
      }
      .expired {
        color: #b91c1c;
        border-color: rgba(239, 68, 68, 0.4);
        background: linear-gradient(180deg, rgba(254, 226, 226, 0.95), rgba(252, 165, 165, 0.35));
      }
      .expiring {
        color: #a16207;
        border-color: rgba(245, 158, 11, 0.45);
        background: linear-gradient(180deg, rgba(254, 249, 195, 0.95), rgba(253, 224, 71, 0.35));
      }
      .safe {
        color: #047857;
        border-color: rgba(16, 185, 129, 0.4);
        background: linear-gradient(180deg, rgba(209, 250, 229, 0.95), rgba(110, 231, 183, 0.35));
      }
      .low {
        color: #c2410c;
        border-color: rgba(249, 115, 22, 0.45);
        background: linear-gradient(180deg, rgba(255, 237, 213, 0.95), rgba(253, 186, 116, 0.4));
      }
    `
  ]
})
export class StockStatusBadgeComponent {
  @Input() kind: 'expired' | 'expiring' | 'safe' | 'low' = 'safe';

  get label(): string {
    switch (this.kind) {
      case 'expired':
        return 'Expired';
      case 'expiring':
        return 'Expiring soon';
      case 'low':
        return 'Low stock';
      default:
        return 'OK';
    }
  }
}
