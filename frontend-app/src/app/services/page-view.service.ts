import { Injectable, inject, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { environment } from '../../environments/environment';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare function gtag(...args: unknown[]): void;

/**
 * Thin wrapper around Google Analytics 4 (gtag.js) that sends a
 * `page_view` event on every Angular route change.
 *
 * GA's built-in tracking only fires on full page loads, so SPAs need
 * to push virtual page-views manually after each client-side navigation.
 *
 * The GA Measurement ID is pulled from `environment.gaId`.
 * If the ID is missing or the gtag script hasn't loaded, all calls
 * are silently skipped so the app never breaks.
 */
@Injectable({ providedIn: 'root' })
export class PageViewService implements OnDestroy {
  private readonly router = inject(Router);
  private sub: Subscription | null = null;

  /** Start listening to route changes and forwarding them to GA */
  init(): void {
    if (this.sub) return;
    if (!environment.gaId || typeof gtag === 'undefined') return;

    // Track the initial page load (the gtag snippet handles this too,
    // but an explicit call ensures the correct SPA path is recorded)
    this.sendPageView(this.router.url);

    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.sendPageView(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private sendPageView(path: string): void {
    gtag('config', environment.gaId, {
      page_path: path,
      page_title: this.derivePageTitle(path),
    });
  }

  /**
   * Derive a human-readable page title from the URL so GA reports
   * show friendly names instead of raw paths.
   */
  private derivePageTitle(path: string): string {
    const clean = path.split('?')[0].replace(/^\/+|\/+$/g, '');

    if (!clean) return 'Home';

    const segments = clean.split('/');

    const knownPages: Record<string, string> = {
      about: 'About',
      contact: 'Contact',
    };

    if (segments.length === 1) {
      return knownPages[segments[0]] || 'Profile Map';
    }

    // /:username/explore → "Explore", /:username/trips → "Trips"
    const last = segments[segments.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
}
