import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MapComponent, MapMarker, MapOverlay, OverlayClickEvent } from '@shared/components';
import {
  ExploreService,
  ExploreCountry,
  ExploreState,
  ExploreCity,
  ExploreAttraction,
  WikipediaContent,
} from '../../services/explore.service';

type ExploreLevel = 'countries' | 'states' | 'cities' | 'city' | 'attractions' | 'attraction';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private exploreService = inject(ExploreService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  username = signal<string>('');
  level = signal<ExploreLevel>('countries');
  loading = signal(false);

  selectedCountry = signal<ExploreCountry | null>(null);
  selectedState = signal<ExploreState | null>(null);
  selectedCity = signal<ExploreCity | null>(null);
  selectedAttraction = signal<ExploreAttraction | null>(null);
  wikiContent = signal<WikipediaContent | null>(null);
  wikiLoading = signal(false);

  countries = signal<ExploreCountry[]>([]);
  states = signal<ExploreState[]>([]);
  cities = signal<ExploreCity[]>([]);
  attractions = signal<ExploreAttraction[]>([]);

  // Plain array (not signal) to avoid repeated ngOnChanges on the map component
  countryMapOverlays: MapOverlay[] = [];

  private readonly stateColors = [
    { fill: '#1a365d', border: '#0d1b2a' },
    { fill: '#2a4a7f', border: '#1a365d' },
    { fill: '#2b6cb0', border: '#2a4a7f' },
    { fill: '#3182ce', border: '#2b6cb0' },
    { fill: '#4299e1', border: '#3182ce' },
    { fill: '#63b3ed', border: '#4299e1' },
    { fill: '#90cdf4', border: '#63b3ed' },
    { fill: '#2c5282', border: '#1a365d' },
    { fill: '#2563eb', border: '#1e40af' },
    { fill: '#3b82f6', border: '#2563eb' },
    { fill: '#60a5fa', border: '#3b82f6' },
    { fill: '#93c5fd', border: '#60a5fa' },
    { fill: '#1e40af', border: '#1e3a8a' },
    { fill: '#1d4ed8', border: '#1e40af' },
    { fill: '#0e7490', border: '#155e75' },
    { fill: '#0891b2', border: '#0e7490' },
    { fill: '#06b6d4', border: '#0891b2' },
    { fill: '#22d3ee', border: '#06b6d4' },
    { fill: '#0284c7', border: '#0369a1' },
    { fill: '#0ea5e9', border: '#0284c7' },
  ];

  private baseUrl = computed(() => `/${this.username()}/explore`);

  /** Map markers for the country page — show cities as pins when on states or cities level */
  countryMapMarkers = computed<MapMarker[]>(() => {
    const lvl = this.level();
    if (lvl === 'cities') {
      return this.cities()
        .filter((c) => c.lat && c.lng)
        .map((c) => ({
          lat: c.lat,
          lng: c.lng,
          title: c.name,
          popup: `<strong>${c.name}</strong>`,
        }));
    }
    return [];
  });

  /** Map center for the country page — use hardcoded values for US/CA, otherwise country coords */
  countryMapCenter = computed<[number, number]>(() => {
    const country = this.selectedCountry();
    const abbr = (country?.abbreviation || '').toUpperCase();
    const name = (country?.name || '').toLowerCase();
    // Continental US center
    if (abbr === 'US' || abbr === 'USA' || name.includes('united states')) {
      return [39.8, -98.6];
    }
    // Canada center
    if (abbr === 'CA' || abbr === 'CAN' || name.includes('canada')) {
      return [56.1, -106.3];
    }
    if (country?.lat && country?.lng) {
      return [country.lat, country.lng];
    }
    return [20, 0];
  });

  countryMapZoom = computed<number>(() => {
    const country = this.selectedCountry();
    const abbr = (country?.abbreviation || '').toUpperCase();
    const name = (country?.name || '').toLowerCase();
    if (abbr === 'US' || abbr === 'USA' || name.includes('united states')) return 3;
    if (abbr === 'CA' || abbr === 'CAN' || name.includes('canada')) return 3;
    return 5;
  });

  cityMapMarkers = computed<MapMarker[]>(() => {
    const c = this.selectedCity();
    if (!c) return [];
    return [{ lat: c.lat, lng: c.lng, title: c.name, popup: `<strong>${c.name}</strong>` }];
  });

  cityMapCenter = computed<[number, number]>(() => {
    const c = this.selectedCity();
    return c ? [c.lat, c.lng] : [0, 0];
  });

  attractionMapMarkers = computed<MapMarker[]>(() => {
    const a = this.selectedAttraction();
    if (!a) return [];
    return [{ lat: a.lat, lng: a.lng, title: a.name, popup: `<strong>${a.name}</strong>` }];
  });

  attractionMapCenter = computed<[number, number]>(() => {
    const a = this.selectedAttraction();
    return a ? [a.lat, a.lng] : [0, 0];
  });

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
    if ((lvl === 'attractions' || lvl === 'attraction') && country) {
      const countryAbbr = country.abbreviation || country.name;
      crumbs.push({
        label: 'Attractions',
        url: `${this.baseUrl()}/${countryAbbr}/attractions`,
      });
    }
    const city = this.selectedCity();
    if (lvl === 'city' && city && country) {
      const countryAbbr = country.abbreviation || country.name;
      const stateAbbr = state ? (state.abbr || state.name) : null;
      const segments = [this.baseUrl(), countryAbbr];
      if (stateAbbr) segments.push(stateAbbr);
      segments.push(this.toSlug(city.name));
      crumbs.push({
        label: city.name,
        url: segments.join('/'),
      });
    }
    const attraction = this.selectedAttraction();
    if (lvl === 'attraction' && attraction && country) {
      const countryAbbr = country.abbreviation || country.name;
      crumbs.push({
        label: attraction.name,
        url: `${this.baseUrl()}/${countryAbbr}/attractions/${this.toSlug(attraction.name)}`,
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
      case 'city':
        return this.selectedCity()?.name ?? 'City';
      case 'attraction':
        return this.selectedAttraction()?.name ?? 'Attraction';
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
            if (segments.length >= 3) {
              this.loadAttractionsForUrl(country, segments[2]);
            } else {
              this.loadAttractionsForUrl(country);
            }
          } else if (segments.length >= 3) {
            // country/state/city or country/state/city (3 segments)
            this.loadStatesForUrl(country, segments[1], segments[2]);
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
    this.countryMapOverlays = [];
    this.exploreService
      .getStates(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (states) => {
          if (states.length > 0) {
            this.states.set(states);
            this.level.set('states');
            this.loading.set(false);
            this.loadStateOverlays(country, states);
          } else {
            this.loadCitiesForCountry(country.id);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  /** Load GeoJSON overlays for visited states (US and Canada only) */
  private loadStateOverlays(country: ExploreCountry, states: ExploreState[]): void {
    const abbr = (country.abbreviation || '').toUpperCase();
    const name = country.name.toLowerCase();

    // Determine which GeoJSON key to use
    let geoKey: string | null = null;
    if (abbr === 'US' || abbr === 'USA' || name.includes('united states')) {
      geoKey = 'US';
    } else if (abbr === 'CA' || abbr === 'CAN' || name.includes('canada')) {
      geoKey = 'CA';
    }
    if (!geoKey) return;

    const stateNames = states.map((s) => s.name);
    if (stateNames.length === 0) return;

    this.exploreService
      .getStateOutlines(geoKey, stateNames)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (geoJson) => {
          if (geoJson.features.length > 0) {
            const countryAbbr = country.abbreviation || country.name;
            this.countryMapOverlays = geoJson.features.map((feature, i) => {
              const palette = this.stateColors[i % this.stateColors.length];
              const featureName = feature.properties?.['name'] || '';
              const state = states.find(
                (s) => s.name.toLowerCase() === featureName.toLowerCase()
              );
              const stateAbbr = state ? (state.abbr || state.name) : featureName;
              return {
                type: 'state' as const,
                geoJson: {
                  type: 'FeatureCollection' as const,
                  features: [feature],
                },
                style: {
                  fillColor: palette.fill,
                  weight: 2,
                  opacity: 0.8,
                  color: palette.border,
                  fillOpacity: 0.35,
                },
                interactive: true,
                link: `${this.baseUrl()}/${countryAbbr}/${stateAbbr}`,
              };
            });
            this.cdr.detectChanges();
          }
        },
        error: () => {
          // Silently fail — map will show without overlays
        },
      });
  }

  private loadStatesForUrl(country: ExploreCountry, stateAbbr: string, cityName?: string): void {
    this.countryMapOverlays = [];
    this.exploreService
      .getStates(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (states) => {
          this.states.set(states);
          this.loadStateOverlays(country, states);
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
                  if (cityName) {
                    const city = cities.find(
                      (c) => this.matchesSlug(c.name, cityName)
                    );
                    if (city) {
                      this.loadCityDetail(city);
                      return;
                    }
                  }
                  this.level.set('cities');
                  this.loading.set(false);
                },
                error: () => this.loading.set(false),
              });
          } else {
            // stateAbbr might actually be a city name for countries without states
            if (!cityName) {
              this.loadCitiesAndFindCity(country.id, stateAbbr);
            } else {
              this.level.set('states');
              this.loading.set(false);
            }
          }
        },
        error: () => this.loading.set(false),
      });
  }

  private loadCitiesAndFindCity(countryId: number, cityName: string): void {
    this.exploreService
      .getCities(countryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cities) => {
          this.cities.set(cities);
          const city = cities.find(
            (c) => this.matchesSlug(c.name, cityName)
          );
          if (city) {
            this.loadCityDetail(city);
          } else {
            this.level.set('cities');
            this.loading.set(false);
          }
        },
        error: () => this.loading.set(false),
      });
  }

  private loadCityDetail(city: ExploreCity): void {
    this.wikiContent.set(null);
    this.exploreService
      .getCityById(city.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullCity) => {
          this.selectedCity.set(fullCity);
          this.level.set('city');
          this.loading.set(false);
          this.loadWikiContent(fullCity.wiki_term || fullCity.name);
        },
        error: () => {
          this.selectedCity.set(city);
          this.level.set('city');
          this.loading.set(false);
          this.loadWikiContent(city.wiki_term || city.name);
        },
      });
  }

  private loadWikiContent(term: string): void {
    this.wikiLoading.set(true);
    this.exploreService
      .getWikipediaContent(term)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (content) => {
          this.wikiContent.set(content);
          this.wikiLoading.set(false);
        },
        error: () => this.wikiLoading.set(false),
      });
  }

  private loadAttractionsForUrl(country: ExploreCountry, attractionName?: string): void {
    this.exploreService
      .getAttractions(country.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attractions) => {
          this.attractions.set(attractions);
          if (attractionName) {
            const attraction = attractions.find(
              (a) => this.matchesSlug(a.name, attractionName)
            );
            if (attraction) {
              this.loadAttractionDetail(attraction);
              return;
            }
          }
          this.level.set('attractions');
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadAttractionDetail(attraction: ExploreAttraction): void {
    this.wikiContent.set(null);
    this.exploreService
      .getAttractionById(attraction.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full) => {
          this.selectedAttraction.set(full);
          this.level.set('attraction');
          this.loading.set(false);
          if (full.wiki_term) {
            this.loadWikiContent(full.wiki_term);
          }
        },
        error: () => {
          this.selectedAttraction.set(attraction);
          this.level.set('attraction');
          this.loading.set(false);
          if (attraction.wiki_term) {
            this.loadWikiContent(attraction.wiki_term);
          }
        },
      });
  }

  // --- Navigation (updates URL without re-routing) ---

  private updateUrl(path: string): void {
    this.location.replaceState(path);
  }

  /** Convert a name to a URL-safe slug: "New York" → "new-york" */
  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  /** Match a slug against a name: "new-york" matches "New York" */
  private matchesSlug(name: string, slug: string): boolean {
    return this.toSlug(name) === slug.toLowerCase();
  }

  onCountryClick(country: ExploreCountry): void {
    const abbr = country.abbreviation || country.name;
    this.updateUrl(`${this.baseUrl()}/${abbr}`);

    this.selectedCountry.set(country);
    this.selectedState.set(null);
    this.loading.set(true);
    this.loadCountryDrillDown(country);
  }

  onOverlayClick(event: OverlayClickEvent): void {
    // Find the matching state by name and navigate to it
    if (event.name) {
      const state = this.states().find(
        (s) => s.name.toLowerCase() === event.name!.toLowerCase()
      );
      if (state) {
        this.onStateClick(state);
        return;
      }
    }
    // Fallback: navigate by URL
    this.router.navigateByUrl(event.link);
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

  onCityClick(city: ExploreCity): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    const state = this.selectedState();
    const stateAbbr = state ? (state.abbr || state.name) : null;
    const citySlug = this.toSlug(city.name);

    const segments = [this.baseUrl(), countryAbbr];
    if (stateAbbr) segments.push(stateAbbr);
    segments.push(citySlug);
    this.updateUrl(segments.join('/'));

    // Load full city details
    this.loading.set(true);
    this.wikiContent.set(null);
    this.exploreService
      .getCityById(city.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (fullCity) => {
          this.selectedCity.set(fullCity);
          this.level.set('city');
          this.loading.set(false);
          this.loadWikiContent(fullCity.wiki_term || fullCity.name);
        },
        error: () => {
          // Fallback: use the city data we already have
          this.selectedCity.set(city);
          this.level.set('city');
          this.loading.set(false);
          this.loadWikiContent(city.wiki_term || city.name);
        },
      });
  }

  onAttractionClick(attraction: ExploreAttraction): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    const attractionSlug = this.toSlug(attraction.name);
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions/${attractionSlug}`);

    this.loading.set(true);
    this.wikiContent.set(null);
    this.exploreService
      .getAttractionById(attraction.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full) => {
          this.selectedAttraction.set(full);
          this.level.set('attraction');
          this.loading.set(false);
          if (full.wiki_term) {
            this.loadWikiContent(full.wiki_term);
          }
        },
        error: () => {
          this.selectedAttraction.set(attraction);
          this.level.set('attraction');
          this.loading.set(false);
          if (attraction.wiki_term) {
            this.loadWikiContent(attraction.wiki_term);
          }
        },
      });
  }

  onBreadcrumbClick(crumb: BreadcrumbItem): void {
    this.updateUrl(crumb.url);

    const subPath = crumb.url.slice(this.baseUrl().length);
    const segments = subPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      // Back to countries list
      this.selectedCountry.set(null);
      this.selectedState.set(null);
      this.selectedCity.set(null);
      this.selectedAttraction.set(null);
      this.countryMapOverlays = [];
      this.level.set('countries');
    } else if (segments.length === 1) {
      // Back to country level (states or cities)
      this.selectedState.set(null);
      this.selectedCity.set(null);
      this.selectedAttraction.set(null);
      if (this.states().length > 0) {
        this.level.set('states');
      } else {
        this.level.set('cities');
      }
    } else if (segments.length === 2 && segments[1].toLowerCase() === 'attractions') {
      // Back to attractions list
      this.selectedAttraction.set(null);
      this.level.set('attractions');
    } else if (segments.length === 2) {
      // Back to state's cities list
      this.selectedCity.set(null);
      this.selectedAttraction.set(null);
      this.level.set('cities');
    }
  }

  goBack(): void {
    const lvl = this.level();
    const country = this.selectedCountry();
    const countryAbbr = country ? (country.abbreviation || country.name) : '';

    if (lvl === 'attraction') {
      this.selectedAttraction.set(null);
      this.wikiContent.set(null);
      this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions`);
      this.level.set('attractions');
    } else if (lvl === 'city') {
      this.selectedCity.set(null);
      const state = this.selectedState();
      if (state) {
        const stateAbbr = state.abbr || state.name;
        this.updateUrl(`${this.baseUrl()}/${countryAbbr}/${stateAbbr}`);
      } else {
        this.updateUrl(`${this.baseUrl()}/${countryAbbr}`);
      }
      this.level.set('cities');
    } else if (lvl === 'attractions') {
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
        this.countryMapOverlays = [];
        this.level.set('countries');
      }
    } else if (lvl === 'states') {
      this.updateUrl(this.baseUrl());
      this.selectedCountry.set(null);
      this.selectedState.set(null);
      this.countryMapOverlays = [];
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

