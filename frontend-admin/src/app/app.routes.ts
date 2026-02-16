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
    path: 'countries',
    loadComponent: () =>
      import('./pages/countries-list/countries-list.component').then((m) => m.CountriesListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'states',
    loadComponent: () =>
      import('./pages/states-list/states-list.component').then((m) => m.StatesListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'cities',
    loadComponent: () =>
      import('./pages/cities-list/cities-list.component').then((m) => m.CitiesListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'attractions',
    loadComponent: () =>
      import('./pages/attractions-list/attractions-list.component').then((m) => m.AttractionsListComponent),
    canActivate: [adminGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
