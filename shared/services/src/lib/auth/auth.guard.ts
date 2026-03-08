import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../login/login.service';

/**
 * Auth guard that checks if the user is authenticated.
 * Redirects to the specified login route if not authenticated.
 *
 * Usage in routes:
 * {
 *   path: 'protected',
 *   component: ProtectedComponent,
 *   canActivate: [authGuard],
 *   data: { loginRoute: '/login' } // optional, defaults to '/login'
 * }
 */
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Get the login route from route data or use default
  const loginRoute = route.data?.['loginRoute'] ?? '/login';

  // Store the attempted URL for redirecting after login
  const returnUrl = route.url.map((segment) => segment.path).join('/');

  return router.createUrlTree([loginRoute], {
    queryParams: { returnUrl: returnUrl || '/' },
  });
};

/**
 * Admin guard that checks if the user is authenticated AND has the 'admin' role.
 * Designed for use in frontend-admin to restrict access to admin users only.
 *
 * Usage in routes:
 * {
 *   path: 'dashboard',
 *   component: DashboardComponent,
 *   canActivate: [adminGuard],
 *   data: {
 *     loginRoute: '/login', // optional, defaults to '/login'
 *     unauthorizedRoute: '/unauthorized' // optional, defaults to '/login'
 *   }
 * }
 */
export const adminGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check if authenticated
  if (!authService.isAuthenticated()) {
    const loginRoute = route.data?.['loginRoute'] ?? '/login';
    const returnUrl = route.url.map((segment) => segment.path).join('/');
    return router.createUrlTree([loginRoute], {
      queryParams: { returnUrl: returnUrl || '/' },
    });
  }

  // Then check if user has admin role
  if (authService.hasRole('admin')) {
    return true;
  }

  // User is authenticated but not an admin
  const unauthorizedRoute = route.data?.['unauthorizedRoute'] ?? '/login';
  return router.createUrlTree([unauthorizedRoute]);
};

/**
 * Role-based auth guard that checks if the user has the required role(s).
 * Must be used in combination with authGuard or after authentication is verified.
 *
 * Usage in routes:
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [authGuard, roleGuard],
 *   data: {
 *     roles: ['admin'], // required roles (user must have at least one)
 *     unauthorizedRoute: '/unauthorized' // optional, defaults to '/'
 *   }
 * }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles: string[] = route.data?.['roles'] ?? [];

  if (requiredRoles.length === 0) {
    return true;
  }

  // Check if user has at least one of the required roles
  const hasRequiredRole = requiredRoles.some((role) => authService.hasRole(role));

  if (hasRequiredRole) {
    return true;
  }

  // Get the unauthorized route from route data or use default
  const unauthorizedRoute = route.data?.['unauthorizedRoute'] ?? '/';

  return router.createUrlTree([unauthorizedRoute]);
};
