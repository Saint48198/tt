import { Route } from '@angular/router';
import { adminGuard } from '@shared/services';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

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
    path: 'users',
    loadComponent: () =>
      import('./pages/users-list/users-list.component').then((m) => m.UsersListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'users/new',
    loadComponent: () =>
      import('./pages/user-edit/user-edit.component').then((m) => m.UserEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'users/:id',
    loadComponent: () =>
      import('./pages/user-edit/user-edit.component').then((m) => m.UserEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'countries',
    loadComponent: () =>
      import('./pages/countries-list/countries-list.component').then((m) => m.CountriesListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'countries/new',
    loadComponent: () =>
      import('./pages/country-edit/country-edit.component').then((m) => m.CountryEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'countries/:id',
    loadComponent: () =>
      import('./pages/country-edit/country-edit.component').then((m) => m.CountryEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'states',
    loadComponent: () =>
      import('./pages/states-list/states-list.component').then((m) => m.StatesListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'states/new',
    loadComponent: () =>
      import('./pages/state-edit/state-edit.component').then((m) => m.StateEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'states/:id',
    loadComponent: () =>
      import('./pages/state-edit/state-edit.component').then((m) => m.StateEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'cities',
    loadComponent: () =>
      import('./pages/cities-list/cities-list.component').then((m) => m.CitiesListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'cities/new',
    loadComponent: () =>
      import('./pages/city-edit/city-edit.component').then((m) => m.CityEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'cities/:id',
    loadComponent: () =>
      import('./pages/city-edit/city-edit.component').then((m) => m.CityEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'attractions',
    loadComponent: () =>
      import('./pages/attractions-list/attractions-list.component').then((m) => m.AttractionsListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'attractions/new',
    loadComponent: () =>
      import('./pages/attraction-edit/attraction-edit.component').then((m) => m.AttractionEditComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'attractions/:id',
    loadComponent: () =>
      import('./pages/attraction-edit/attraction-edit.component').then((m) => m.AttractionEditComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'photos',
    loadComponent: () =>
      import('./pages/photos-list/photos-list.component').then((m) => m.PhotosListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'trips',
    loadComponent: () =>
      import('./pages/trips-list/trips-list.component').then((m) => m.TripsListComponent),
    canActivate: [adminGuard],
  },
  {
    path: 'trips/new',
    loadComponent: () =>
      import('./pages/trip-create/trip-create.component').then((m) => m.TripCreateComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'trips/:id',
    loadComponent: () =>
      import('./pages/trip-edit/trip-edit.component').then((m) => m.TripEditComponent),
    canActivate: [adminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
