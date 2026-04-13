import { Routes } from '@angular/router';
import { authGuard } from './mobile-core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent)
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./pages/transactions/transactions.component').then((m) => m.TransactionsComponent)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/inventory/inventory.component').then((m) => m.InventoryComponent)
      },
      {
        path: 'staff',
        loadComponent: () => import('./pages/staff/staff.component').then((m) => m.StaffComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'home' }
    ]
  },
  { path: '**', redirectTo: 'home' }
];
