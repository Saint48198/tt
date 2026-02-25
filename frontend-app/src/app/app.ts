import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent, FooterComponent } from '@shared/components';
import { AuthService } from '@shared/services';
import { filter, map, startWith } from 'rxjs';
import { PageViewService } from './services/page-view.service';

@Component({
  standalone: true,
  imports: [RouterModule, CommonModule, HeaderComponent, FooterComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected title = 'Trip Tracker';
  private authService = inject(AuthService);
  private router = inject(Router);
  private pageViewService = inject(PageViewService);

  currentUser$ = this.authService.currentUser$;

  footerLinks = [
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  /** True when on a full-screen map page (home or user profile) */
  isLandingPage$ = this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    map((e) => this.isMapRoute((e as NavigationEnd).urlAfterRedirects)),
    startWith(this.isMapRoute(this.router.url))
  );

  /** Nav links are reactive — prefixed with /:username when signed in */
  navLinks$ = this.currentUser$.pipe(
    map((user) => {
      const prefix = user ? `/${user.username}` : '';
      return [
        { label: 'Home', path: prefix || '/' },
        { label: 'Explore', path: `${prefix}/explore` },
        { label: 'My Trips', path: `${prefix}/trips` },
      ];
    })
  );

  ngOnInit(): void {
    // Start page-view usage tracking
    this.pageViewService.init();

    // Redirect / to /:username whenever a signed-in user lands on root
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const user = this.authService.currentUser;
        if (user && (e as NavigationEnd).urlAfterRedirects === '/') {
          this.router.navigate([`/${user.username}`], { replaceUrl: true });
        }
      });

    // Also redirect on initial load — only if the browser URL is truly "/"
    const user = this.authService.currentUser;
    const browserPath = window.location.pathname;
    if (user && browserPath === '/') {
      this.router.navigate([`/${user.username}`], { replaceUrl: true });
    }
  }

  /** Routes that use standard (non-landing) layout even though they are single-segment */
  private static readonly STATIC_ROUTES = new Set(['/about', '/contact']);

  private isMapRoute(url: string): boolean {
    // Root "/" or single-segment "/:username" paths use the full-screen map layout
    // Multi-segment paths like "/:username/explore" use the standard layout
    // Known static routes (e.g. /about) are excluded so the header doesn't overlay content
    const basePath = url.split('?')[0];
    if (App.STATIC_ROUTES.has(basePath)) return false;
    return url === '/' || /^\/[^/]+$/.test(url);
  }
}
