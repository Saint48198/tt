import { Route } from '@angular/router';
import { adminGuard } from '@shared/services';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [adminGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
