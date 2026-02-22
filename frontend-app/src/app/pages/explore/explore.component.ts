import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ExploreService,
  ExploreCountry,
  ExploreState,
  ExploreCity,
  ExploreAttraction,
} from '../../services/explore.service';

type ExploreLevel = 'countries' | 'states' | 'cities' | 'attractions';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private exploreService = inject(ExploreService);
  private destroy$ = new Subject<void>();

  username = signal<string>('');
  level = signal<ExploreLevel>('countries');
  loading = signal(false);

  selectedCountry = signal<ExploreCountry | null>(null);
  selectedState = signal<ExploreState | null>(null);

  countries = signal<ExploreCountry[]>([]);
  states = signal<ExploreState[]>([]);
  cities = signal<ExploreCity[]>([]);
  attractions = signal<ExploreAttraction[]>([]);

  private baseUrl = computed(() => `/${this.username()}/explore`);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const crumbs: BreadcrumbItem[] = [{ label: '🌍 Countries', url: this.baseUrl() }];
    const country = this.selectedCountry();
    const state = this.selectedState();
    const lvl = this.level();

    if (country) {
      const countryAbbr = country.abbreviation || country.name;
      crumbs.push({
        label: country.name,
        url: `${this.baseUrl()}/${countryAbbr}`,
      });
    }
    if (state) {
      const countryAbbr = country?.abbreviation || country?.name || '';
      const stateAbbr = state.abbr || state.name;
      crumbs.push({
        label: state.name,
        url: `${this.baseUrl()}/${countryAbbr}/${stateAbbr}`,
      });
    }
    if (lvl === 'attractions' && country) {
      const countryAbbr = country.abbreviation || country.name;
      crumbs.push({
        label: 'Attractions',
        url: `${this.baseUrl()}/${countryAbbr}/attractions`,
      });
    }
    return crumbs;
  });

  currentTitle = computed(() => {
    const lvl = this.level();
    const country = this.selectedCountry();
    const state = this.selectedState();

    switch (lvl) {
      case 'countries':
        return 'Visited Countries';
      case 'states':
        return `${country?.name ?? ''} — States`;
      case 'cities':
        return state
          ? `${state.name}, ${country?.name ?? ''} — Cities`
          : `${country?.name ?? ''} — Cities`;
      case 'attractions':
        return `${country?.name ?? ''} — Attractions`;
      default:
        return 'Explore';
    }
  });

  ngOnInit(): void {
    // Get username from parent route
    let currentRoute: ActivatedRoute | null = this.route;
    while (currentRoute) {
      const uname = currentRoute.snapshot.paramMap.get('username');
      if (uname) {
        this.username.set(uname);
        break;
      }
      currentRoute = currentRoute.parent;
    }

    if (!this.username()) return;

    // Parse URL segments to restore state
    const url = this.router.url;
    const basePath = `/${this.username()}/explore`;
    const subPath = url.startsWith(basePath) ? url.slice(basePath.length) : '';
    const segments = subPath.split('/').filter(Boolean);

    this.loadFromUrl(segments);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- URL-driven loading ---

  private loadFromUrl(segments: string[]): void {
    this.loading.set(true);

    this.exploreService
      .getVisitedCountries(this.username())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (countries) => {
          this.countries.set(countries);

          if (segments.length === 0) {
            this.level.set('countries');
            this.loading.set(false);
            return;
          }

          // Find country by abbreviation (case-insensitive)
          const countryAbbr = segments[0];
          const country = countries.find(
            (c) => (c.abbreviation || c.name).toLowerCase() === countryAbbr.toLowerCase()
          );

          if (!country) {
            this.level.set('countries');
            this.loading.set(false);
            return;
          }

          this.selectedCountry.set(country);

          if (segments.length >= 2 && segments[1].toLowerCase() === 'attractions') {
            this.loadAttractionsForUrl(country);
          } else if (segments.length >= 2) {
            this.loadStatesForUrl(country, segments[1]);
          } else {
            this.loadCountryDrillDown(country);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  private loadCountryDrillDown(country: ExploreCountry): void {
    this.exploreService
      .getStates(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (states) => {
          if (states.length > 0) {
            this.states.set(states);
            this.level.set('states');
            this.loading.set(false);
          } else {
            this.loadCitiesForCountry(country.id);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  private loadStatesForUrl(country: ExploreCountry, stateAbbr: string): void {
    this.exploreService
      .getStates(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (states) => {
          this.states.set(states);
          const state = states.find(
            (s) => (s.abbr || s.name).toLowerCase() === stateAbbr.toLowerCase()
          );
          if (state) {
            this.selectedState.set(state);
            this.exploreService
              .getCities(state.country_id, state.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (cities) => {
                  this.cities.set(cities);
                  this.level.set('cities');
                  this.loading.set(false);
                },
                error: () => this.loading.set(false),
              });
          } else {
            this.level.set('states');
            this.loading.set(false);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  private loadAttractionsForUrl(country: ExploreCountry): void {
    this.exploreService
      .getAttractions(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attractions) => {
          this.attractions.set(attractions);
          this.level.set('attractions');
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  // --- Navigation (updates URL without re-routing) ---

  private updateUrl(path: string): void {
    this.location.replaceState(path);
  }

  onCountryClick(country: ExploreCountry): void {
    const abbr = country.abbreviation || country.name;
    this.updateUrl(`${this.baseUrl()}/${abbr}`);

    this.selectedCountry.set(country);
    this.selectedState.set(null);
    this.loading.set(true);
    this.loadCountryDrillDown(country);
  }

  onStateClick(state: ExploreState): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    const stateAbbr = state.abbr || state.name;
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/${stateAbbr}`);

    this.selectedState.set(state);
    this.loading.set(true);

    this.exploreService
      .getCities(state.country_id, state.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cities) => {
          this.cities.set(cities);
          this.level.set('cities');
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onViewAttractions(): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions`);

    this.loading.set(true);
    this.exploreService
      .getAttractions(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attractions) => {
          this.attractions.set(attractions);
          this.level.set('attractions');
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onBreadcrumbClick(crumb: BreadcrumbItem): void {
    this.updateUrl(crumb.url);

    const subPath = crumb.url.slice(this.baseUrl().length);
    const segments = subPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      this.selectedCountry.set(null);
      this.selectedState.set(null);
      this.level.set('countries');
    } else if (segments.length === 1) {
      this.selectedState.set(null);
      if (this.states().length > 0) {
        this.level.set('states');
      } else {
        this.level.set('cities');
      }
    }
  }

  goBack(): void {
    const lvl = this.level();
    const country = this.selectedCountry();
    const countryAbbr = country ? (country.abbreviation || country.name) : '';

    if (lvl === 'attractions') {
      this.updateUrl(`${this.baseUrl()}/${countryAbbr}`);
      if (this.states().length > 0) {
        this.level.set('states');
      } else {
        this.level.set('cities');
      }
    } else if (lvl === 'cities') {
      if (this.states().length > 0) {
        this.updateUrl(`${this.baseUrl()}/${countryAbbr}`);
        this.selectedState.set(null);
        this.level.set('states');
      } else {
        this.updateUrl(this.baseUrl());
        this.selectedCountry.set(null);
        this.level.set('countries');
      }
    } else if (lvl === 'states') {
      this.updateUrl(this.baseUrl());
      this.selectedCountry.set(null);
      this.selectedState.set(null);
      this.level.set('countries');
    }
  }

  // --- Data Loading ---

  private loadCitiesForCountry(countryId: number): void {
    this.exploreService
      .getCities(countryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cities) => {
          this.cities.set(cities);
          this.level.set('cities');
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }
}

