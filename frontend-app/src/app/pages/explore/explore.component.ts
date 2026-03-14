import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  signal,
  computed,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, EMPTY } from 'rxjs';
import { takeUntil, switchMap, tap, finalize } from 'rxjs/operators';
import {
  MapComponent,
  MapMarker,
  MapOverlay,
  OverlayClickEvent,
  LightboxComponent,
  LightboxPhoto,
} from '@shared/components';
import {
  ExploreService,
  ExploreDetailService,
  ExploreCountry,
  ExploreState,
  ExploreCity,
  ExploreAttraction,
} from '../../services/explore.service';
import { PhotoService } from '../../services/photo.service';
import { EntityDetailComponent } from './entity-detail/entity-detail.component';
import { EntityListComponent, EntityListItem } from './entity-list/entity-list.component';

type ExploreLevel = 'countries' | 'states' | 'cities' | 'city' | 'attractions' | 'attraction';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-explore',
  imports: [
    MapComponent,
    RouterLink,
    EntityDetailComponent,
    LightboxComponent,
    EntityListComponent,
  ],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private exploreService = inject(ExploreService);
  private photoService = inject(PhotoService);
  readonly detailService = inject(ExploreDetailService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  username = signal<string>('');
  level = signal<ExploreLevel>('countries');
  loading = signal(false);

  selectedCountry = signal<ExploreCountry | null>(null);
  selectedState = signal<ExploreState | null>(null);

  /** Delegated to detail service */
  selectedCity = computed(() => this.detailService.city());
  selectedAttraction = computed(() => this.detailService.attraction());

  countries = signal<ExploreCountry[]>([]);
  states = signal<ExploreState[]>([]);
  cities = signal<ExploreCity[]>([]);
  attractions = signal<ExploreAttraction[]>([]);

  // --- EntityListItem mappings ---
  countryItems = computed<EntityListItem[]>(() =>
    this.countries().map((c) => ({
      id: c.id,
      name: c.name,
      badge: c.abbreviation,
      icon: 'pin' as const,
      lastVisited: c.last_visited,
    }))
  );

  stateItems = computed<EntityListItem[]>(() =>
    this.states().map((s) => ({
      id: s.id,
      name: s.name,
      badge: s.abbr,
      icon: 'capitol' as const,
      lastVisited: s.last_visited,
    }))
  );

  cityItems = computed<EntityListItem[]>(() =>
    this.cities().map((c) => ({
      id: c.id,
      name: c.name,
      subtitle: c.state_name,
      icon: 'skyline' as const,
      lastVisited: c.last_visited,
    }))
  );

  attractionItems = computed<EntityListItem[]>(() =>
    this.attractions().map((a) => ({
      id: a.id,
      name: a.name,
      icon: this.getAttractionIcon(a),
      lastVisited: a.last_visited,
      tags: a.types,
    }))
  );

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
  photoMapLink = computed(() => `/${this.username()}/explore/photo-map`);

  /** Query params to filter photo map by selected country/state */
  photoMapQueryParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    const country = this.selectedCountry();
    if (country) {
      params['country'] = country.abbreviation || country.name;
    }
    const state = this.selectedState();
    if (state) {
      params['state'] = state.abbr || state.name;
    }
    return params;
  });

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

  /** Map center — when a state is selected, center on its cities; otherwise use country center */
  countryMapCenter = computed<[number, number]>(() => {
    // When viewing cities within a state, center on those cities
    if (this.level() === 'cities' && this.selectedState()) {
      const stateCities = this.cities().filter((c) => c.lat && c.lng);
      if (stateCities.length > 0) {
        const avgLat = stateCities.reduce((sum, c) => sum + c.lat, 0) / stateCities.length;
        const avgLng = stateCities.reduce((sum, c) => sum + c.lng, 0) / stateCities.length;
        return [avgLat, avgLng];
      }
    }

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

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const crumbs: BreadcrumbItem[] = [{ label: 'Countries', url: this.baseUrl() }];
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
      const stateAbbr = state ? state.abbr || state.name : null;
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

    this.loadCountries$()
      .pipe(
        switchMap((countries) => {
          if (segments.length === 0) {
            this.level.set('countries');
            return EMPTY;
          }

          const countryAbbr = segments[0];
          const country = countries.find(
            (c) => (c.abbreviation || c.name).toLowerCase() === countryAbbr.toLowerCase()
          );

          if (!country) {
            this.level.set('countries');
            return EMPTY;
          }

          this.selectedCountry.set(country);

          if (segments.length >= 2 && segments[1].toLowerCase() === 'attractions') {
            return this.loadAttractionsForUrl$(country, segments[2]);
          } else if (segments.length >= 3) {
            return this.loadStatesForUrl$(country, segments[1], segments[2]);
          } else if (segments.length >= 2) {
            return this.loadStatesForUrl$(country, segments[1]);
          } else {
            return this.loadCountryDrillDown$(country);
          }
        }),
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  private loadCountries$(): Observable<ExploreCountry[]> {
    return this.exploreService
      .getVisitedCountries(this.username())
      .pipe(tap((countries) => this.countries.set(countries)));
  }

  private loadCountryDrillDown$(country: ExploreCountry): Observable<void> {
    this.countryMapOverlays = [];
    if (!this.isStateCountry(country)) {
      return this.loadCitiesForCountry$(country.id);
    }
    return this.exploreService.getStates(country.id).pipe(
      switchMap((states) => {
        if (states.length > 0) {
          this.states.set(states);
          this.level.set('states');
          this.loadStateOverlays(country, states);
          return EMPTY;
        }
        return this.loadCitiesForCountry$(country.id);
      })
    );
  }

  /** Check if a country uses states/provinces (US or Canada) */
  private isStateCountry(country: ExploreCountry): boolean {
    const abbr = (country.abbreviation || '').toUpperCase();
    const name = country.name.toLowerCase();
    return (
      abbr === 'US' ||
      abbr === 'USA' ||
      name.includes('united states') ||
      abbr === 'CA' ||
      abbr === 'CAN' ||
      name.includes('canada')
    );
  }

  /** Load GeoJSON overlays for visited states (US and Canada only) */
  private loadStateOverlays(country: ExploreCountry, states: ExploreState[]): void {
    if (!this.isStateCountry(country)) return;

    const abbr = (country.abbreviation || '').toUpperCase();
    const name = country.name.toLowerCase();
    const geoKey = abbr === 'CA' || abbr === 'CAN' || name.includes('canada') ? 'CA' : 'US';

    const stateNames = states.map((s) => s.name);
    if (stateNames.length === 0) return;

    this.exploreService
      .getStateOutlines(geoKey, stateNames)
      .pipe(
        takeUntil(this.destroy$),
        tap((geoJson) => {
          if (geoJson.features.length > 0) {
            const countryAbbr = country.abbreviation || country.name;
            this.countryMapOverlays = geoJson.features.map((feature, i) => {
              const palette = this.stateColors[i % this.stateColors.length];
              const featureName = feature.properties?.['name'] || '';
              const state = states.find((s) => s.name.toLowerCase() === featureName.toLowerCase());
              const stateAbbr = state ? state.abbr || state.name : featureName;
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
        })
      )
      .subscribe();
  }

  private filterOverlaysToState(state: ExploreState): void {
    const stateOverlay = this.countryMapOverlays.find((o) => {
      const gj = o.geoJson as GeoJSON.FeatureCollection;
      return gj.features?.some(
        (f) => f.properties?.['name']?.toLowerCase() === state.name.toLowerCase()
      );
    });
    this.countryMapOverlays = stateOverlay ? [stateOverlay] : [];
  }

  private loadStatesForUrl$(
    country: ExploreCountry,
    stateAbbr: string,
    cityName?: string
  ): Observable<void> {
    this.countryMapOverlays = [];

    // For non-state countries, the segment is a city name, not a state abbreviation
    if (!this.isStateCountry(country)) {
      return this.loadCitiesAndFindCity$(country.id, stateAbbr);
    }

    return this.exploreService.getStates(country.id).pipe(
      tap((states) => {
        this.states.set(states);
        this.loadStateOverlays(country, states);
      }),
      switchMap((states) => {
        const state = states.find(
          (s) => (s.abbr || s.name).toLowerCase() === stateAbbr.toLowerCase()
        );
        if (state) {
          this.selectedState.set(state);
          // Filter overlays to only show the selected state
          this.filterOverlaysToState(state);
          return this.exploreService.getCities(state.country_id, state.id).pipe(
            switchMap((cities) => {
              this.cities.set(cities);
              if (cityName) {
                const city = cities.find((c) => this.matchesSlug(c.name, cityName));
                if (city) {
                  return this.loadCityDetail$(city);
                }
              }
              this.level.set('cities');
              return EMPTY;
            })
          );
        }
        // stateAbbr might actually be a city name for countries without states
        if (!cityName) {
          return this.loadCitiesAndFindCity$(country.id, stateAbbr);
        }
        this.level.set('states');
        return EMPTY;
      })
    );
  }

  private loadCitiesAndFindCity$(countryId: number, cityName: string): Observable<void> {
    return this.exploreService.getCities(countryId).pipe(
      switchMap((cities) => {
        this.cities.set(cities);
        const city = cities.find((c) => this.matchesSlug(c.name, cityName));
        if (city) {
          return this.loadCityDetail$(city);
        }
        this.level.set('cities');
        return EMPTY;
      })
    );
  }

  private loadCityDetail$(city: ExploreCity): Observable<void> {
    this.level.set('city');
    return this.detailService.loadCityDetail$(city);
  }

  private loadAttractionsForUrl$(
    country: ExploreCountry,
    attractionName?: string
  ): Observable<void> {
    return this.exploreService.getAttractions(country.id).pipe(
      switchMap((attractions) => {
        this.attractions.set(attractions);
        if (attractionName) {
          const attraction = attractions.find((a) => this.matchesSlug(a.name, attractionName));
          if (attraction) {
            return this.loadAttractionDetail$(attraction);
          }
        }
        this.level.set('attractions');
        return EMPTY;
      })
    );
  }

  private loadAttractionDetail$(attraction: ExploreAttraction): Observable<void> {
    this.level.set('attraction');
    return this.detailService.loadAttractionDetail$(attraction);
  }

  // --- Navigation (updates URL without re-routing) ---

  private updateUrl(path: string): void {
    this.location.replaceState(path);
  }

  /** Convert a name to a URL-safe slug: "New York" → "new-york" */
  toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
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

    this.loadCountryDrillDown$(country)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  onOverlayClick(event: OverlayClickEvent): void {
    // Find the matching state by name and navigate to it
    if (event.name) {
      const eventName = event.name;
      const state = this.states().find((s) => s.name.toLowerCase() === eventName.toLowerCase());
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

    // Filter overlays to only show the selected state
    this.filterOverlaysToState(state);

    this.exploreService
      .getCities(state.country_id, state.id)
      .pipe(
        tap((cities) => {
          this.cities.set(cities);
          this.level.set('cities');
        }),
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  onViewAttractions(): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions`);

    this.loading.set(true);
    this.exploreService
      .getAttractions(country.id)
      .pipe(
        tap((attractions) => {
          this.attractions.set(attractions);
          this.level.set('attractions');
        }),
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  onCityClick(city: ExploreCity): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    const state = this.selectedState();
    const stateAbbr = state ? state.abbr || state.name : null;
    const citySlug = this.toSlug(city.name);

    const segments = [this.baseUrl(), countryAbbr];
    if (stateAbbr) segments.push(stateAbbr);
    segments.push(citySlug);
    this.updateUrl(segments.join('/'));

    this.loading.set(true);
    this.loadCityDetail$(city)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  onAttractionClick(attraction: ExploreAttraction): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    const attractionSlug = this.toSlug(attraction.name);
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions/${attractionSlug}`);

    this.loading.set(true);
    this.loadAttractionDetail$(attraction)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  onBreadcrumbClick(crumb: BreadcrumbItem): void {
    this.updateUrl(crumb.url);

    const subPath = crumb.url.slice(this.baseUrl().length);
    const segments = subPath.split('/').filter(Boolean);

    if (segments.length === 0) {
      // Back to countries list
      this.selectedCountry.set(null);
      this.selectedState.set(null);
      this.detailService.reset();
      this.countryMapOverlays = [];
      this.level.set('countries');
    } else if (segments.length === 1) {
      // Back to country level (states or cities)
      this.selectedState.set(null);
      this.detailService.reset();
      if (this.states().length > 0) {
        // Restore all state overlays
        const country = this.selectedCountry();
        if (country) {
          this.loadStateOverlays(country, this.states());
        }
        this.level.set('states');
      } else {
        this.level.set('cities');
      }
    } else if (segments.length === 2 && segments[1].toLowerCase() === 'attractions') {
      // Back to attractions list
      this.detailService.reset();
      this.level.set('attractions');
    } else if (segments.length === 2) {
      // Back to state's cities list
      this.detailService.reset();
      this.level.set('cities');
    }
  }

  goBack(): void {
    const lvl = this.level();
    const country = this.selectedCountry();
    const countryAbbr = country ? country.abbreviation || country.name : '';

    if (lvl === 'attraction') {
      this.detailService.reset();
      this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions`);
      this.level.set('attractions');
    } else if (lvl === 'city') {
      this.detailService.reset();
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
        // Restore all state overlays
        const country = this.selectedCountry();
        if (country) {
          this.loadStateOverlays(country, this.states());
        }
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

  private loadCitiesForCountry$(countryId: number): Observable<void> {
    return this.exploreService.getCities(countryId).pipe(
      tap((cities) => {
        this.cities.set(cities);
        this.level.set('cities');
      }),
      switchMap(() => EMPTY)
    );
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  hasType(attraction: ExploreAttraction, slug: string): boolean {
    return attraction.types?.some((t) => t.slug === slug) ?? false;
  }

  private getAttractionIcon(attraction: ExploreAttraction): EntityListItem['icon'] {
    if (this.hasType(attraction, 'unesco')) return 'unesco';
    if (this.hasType(attraction, 'national-park')) return 'tree';
    if (this.hasType(attraction, 'state-park')) return 'park';
    return 'castle';
  }

  // --- Entity list card click handlers ---
  onCountryCardClick(item: EntityListItem): void {
    const country = this.countries().find((c) => c.id === item.id);
    if (country) this.onCountryClick(country);
  }

  onStateCardClick(item: EntityListItem): void {
    const state = this.states().find((s) => s.id === item.id);
    if (state) this.onStateClick(state);
  }

  onCityCardClick(item: EntityListItem): void {
    const city = this.cities().find((c) => c.id === item.id);
    if (city) this.onCityClick(city);
  }

  onAttractionCardClick(item: EntityListItem): void {
    const attraction = this.attractions().find((a) => a.id === item.id);
    if (attraction) this.onAttractionClick(attraction);
  }

  // --- Lightbox for entity photos ---
  lightboxPhotos = signal<LightboxPhoto[]>([]);
  lightboxOpen = signal(false);
  lightboxIndex = signal(0);

  private openLightboxForEntity(
    fetchFn: (
      id: number,
      page: number,
      limit: number
    ) => Observable<{ photos: { url: string; caption?: string | null }[] }>,
    entityId: number
  ): void {
    fetchFn
      .call(this.photoService, entityId, 1, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: { photos: { url: string; caption?: string | null }[] }) => {
        if (res.photos.length > 0) {
          this.lightboxPhotos.set(
            res.photos.map((p) => ({ url: p.url, caption: p.caption ?? undefined }))
          );
          this.lightboxIndex.set(0);
          this.lightboxOpen.set(true);
        }
      });
  }

  onCountryPhotoClick(item: EntityListItem): void {
    this.openLightboxForEntity(this.photoService.getCountryPhotos, item.id);
  }

  onStatePhotoClick(item: EntityListItem): void {
    this.openLightboxForEntity(this.photoService.getStatePhotos, item.id);
  }

  onCityPhotoClick(item: EntityListItem): void {
    this.openLightboxForEntity(this.photoService.getCityPhotos, item.id);
  }

  onViewAllStatePhotos(): void {
    const state = this.selectedState();
    if (!state) return;
    this.openLightboxForEntity(this.photoService.getStatePhotos, state.id);
  }

  onViewAllCountryPhotos(): void {
    const country = this.selectedCountry();
    if (!country) return;
    this.openLightboxForEntity(this.photoService.getCountryPhotos, country.id);
  }

  onLightboxClose(): void {
    this.lightboxOpen.set(false);
  }

  onLightboxIndexChange(index: number): void {
    this.lightboxIndex.set(index);
  }
}
