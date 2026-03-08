import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then((m) => m.AboutComponent)
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent)
  },
  {
    path: ':username/explore',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/explore/explore.component').then((m) => m.ExploreComponent)
      },
      {
        path: 'photo-map',
        loadComponent: () =>
          import('./pages/photo-map/photo-map.component').then((m) => m.PhotoMapComponent)
      },
      {
        path: '**',
        loadComponent: () =>
          import('./pages/explore/explore.component').then((m) => m.ExploreComponent)
      },
    ],
  },
  {
    path: ':username/trips',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/trips/trips.component').then((m) => m.TripsComponent)
  },
  {
    path: ':username/trips/:id',
    loadComponent: () =>
      import('./pages/trip-detail/trip-detail.component').then((m) => m.TripDetailComponent)
  },
  {
    path: ':username',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent)
  },
  {
    path: '**',
    redirectTo: '',
  },
];
