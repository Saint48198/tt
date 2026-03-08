import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ChangeDetectorRef,
  HostListener,
  ViewChild,
  ElementRef,
  signal,
  computed,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, EMPTY, of } from 'rxjs';
import { takeUntil, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { MapComponent, MapMarker, MapOverlay, OverlayClickEvent, ImageLoaderComponent } from '@shared/components';
import {
  ExploreService,
  ExploreCountry,
  ExploreState,
  ExploreCity,
  ExploreAttraction,
  WikipediaContent,
} from '../../services/explore.service';
import { PhotoService, EntityPhoto } from '../../services/photo.service';

type ExploreLevel = 'countries' | 'states' | 'cities' | 'city' | 'attractions' | 'attraction';

interface BreadcrumbItem {
  label: string;
  url: string;
}

@Component({
  selector: 'app-explore',
  imports: [MapComponent, ImageLoaderComponent, RouterLink],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('lightboxDialog') lightboxDialogRef?: ElementRef<HTMLElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private exploreService = inject(ExploreService);
  private photoService = inject(PhotoService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  /** Element that triggered lightbox open — restored on close */
  private lightboxTriggerEl: HTMLElement | null = null;
  /** Whether the lightbox needs initial focus after rendering */
  private lightboxNeedsFocus = false;

  username = signal<string>('');
  level = signal<ExploreLevel>('countries');
  loading = signal(false);

  selectedCountry = signal<ExploreCountry | null>(null);
  selectedState = signal<ExploreState | null>(null);
  selectedCity = signal<ExploreCity | null>(null);
  selectedAttraction = signal<ExploreAttraction | null>(null);
  wikiContent = signal<WikipediaContent | null>(null);
  wikiLoading = signal(false);

  // Photos
  photos = signal<EntityPhoto[]>([]);
  photosLoading = signal(false);
  photosPage = signal(1);
  photosTotal = signal(0);
  readonly photosPerPage = 15;
  lightboxOpen = signal(false);
  lightboxIndex = signal(0);
  lightboxImageLoading = signal(false);
  lightboxImageSize = signal<{ width: number; height: number } | null>(null);

  totalPhotoPages = computed(() =>
    Math.max(1, Math.ceil(this.photosTotal() / this.photosPerPage))
  );

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
  photoMapLink = computed(() => `/${this.username()}/explore/photo-map`);

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

    this.loadCountries$().pipe(
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
      finalize(() => this.loading.set(false)),
    ).subscribe();
  }

  private loadCountries$(): Observable<ExploreCountry[]> {
    return this.exploreService.getVisitedCountries(this.username()).pipe(
      tap((countries) => this.countries.set(countries)),
    );
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
      }),
    );
  }

  /** Check if a country uses states/provinces (US or Canada) */
  private isStateCountry(country: ExploreCountry): boolean {
    const abbr = (country.abbreviation || '').toUpperCase();
    const name = country.name.toLowerCase();
    return abbr === 'US' || abbr === 'USA' || name.includes('united states')
      || abbr === 'CA' || abbr === 'CAN' || name.includes('canada');
  }

  /** Load GeoJSON overlays for visited states (US and Canada only) */
  private loadStateOverlays(country: ExploreCountry, states: ExploreState[]): void {
    if (!this.isStateCountry(country)) return;

    const abbr = (country.abbreviation || '').toUpperCase();
    const name = country.name.toLowerCase();
    const geoKey = (abbr === 'CA' || abbr === 'CAN' || name.includes('canada')) ? 'CA' : 'US';

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
        }),
      ).subscribe();
  }

  private loadStatesForUrl$(country: ExploreCountry, stateAbbr: string, cityName?: string): Observable<void> {
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
            }),
          );
        }
        // stateAbbr might actually be a city name for countries without states
        if (!cityName) {
          return this.loadCitiesAndFindCity$(country.id, stateAbbr);
        }
        this.level.set('states');
        return EMPTY;
      }),
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
      }),
    );
  }

  private loadCityDetail$(city: ExploreCity): Observable<void> {
    this.wikiContent.set(null);
    this.photos.set([]);
    return this.exploreService.getCityById(city.id).pipe(
      catchError(() => of(city)),
      tap((fullCity) => {
        this.selectedCity.set(fullCity);
        this.level.set('city');
        this.loadWikiContent(fullCity.wiki_term || fullCity.name);
        this.loadPhotosForCity(fullCity.id);
      }),
      switchMap(() => EMPTY),
    );
  }

  private loadWikiContent(term: string): void {
    this.wikiLoading.set(true);
    this.exploreService
      .getWikipediaContent(term)
      .pipe(
        takeUntil(this.destroy$),
        tap((content) => this.wikiContent.set(content)),
        finalize(() => this.wikiLoading.set(false)),
      ).subscribe();
  }

  private loadAttractionsForUrl$(country: ExploreCountry, attractionName?: string): Observable<void> {
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
      }),
    );
  }

  private loadAttractionDetail$(attraction: ExploreAttraction): Observable<void> {
    this.wikiContent.set(null);
    this.photos.set([]);
    return this.exploreService.getAttractionById(attraction.id).pipe(
      catchError(() => of(attraction)),
      tap((full) => {
        this.selectedAttraction.set(full);
        this.level.set('attraction');
        if (full.wiki_term) {
          this.loadWikiContent(full.wiki_term);
        }
        this.loadPhotosForAttraction(full.id);
      }),
      switchMap(() => EMPTY),
    );
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

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onCountryClick(country: ExploreCountry): void {
    const abbr = country.abbreviation || country.name;
    this.updateUrl(`${this.baseUrl()}/${abbr}`);

    this.selectedCountry.set(country);
    this.selectedState.set(null);
    this.loading.set(true);

    this.loadCountryDrillDown$(country).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loading.set(false)),
    ).subscribe();
  }

  onOverlayClick(event: OverlayClickEvent): void {
    // Find the matching state by name and navigate to it
    if (event.name) {
      const eventName = event.name;
      const state = this.states().find(
        (s) => s.name.toLowerCase() === eventName.toLowerCase()
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

    this.exploreService.getCities(state.country_id, state.id).pipe(
      tap((cities) => {
        this.cities.set(cities);
        this.level.set('cities');
      }),
      takeUntil(this.destroy$),
      finalize(() => this.loading.set(false)),
    ).subscribe();
  }

  onViewAttractions(): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions`);

    this.loading.set(true);
    this.exploreService.getAttractions(country.id).pipe(
      tap((attractions) => {
        this.attractions.set(attractions);
        this.level.set('attractions');
      }),
      takeUntil(this.destroy$),
      finalize(() => this.loading.set(false)),
    ).subscribe();
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

    this.loading.set(true);
    this.loadCityDetail$(city).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loading.set(false)),
    ).subscribe();
  }

  onAttractionClick(attraction: ExploreAttraction): void {
    const country = this.selectedCountry();
    if (!country) return;
    const countryAbbr = country.abbreviation || country.name;
    const attractionSlug = this.toSlug(attraction.name);
    this.updateUrl(`${this.baseUrl()}/${countryAbbr}/attractions/${attractionSlug}`);

    this.loading.set(true);
    this.loadAttractionDetail$(attraction).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loading.set(false)),
    ).subscribe();
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

  private loadCitiesForCountry$(countryId: number): Observable<void> {
    return this.exploreService.getCities(countryId).pipe(
      tap((cities) => {
        this.cities.set(cities);
        this.level.set('cities');
      }),
      switchMap(() => EMPTY),
    );
  }

  // --- Photo Loading ---

  /** Current photo entity context for server-side pagination */
  private photoEntityType: 'cities' | 'attractions' | null = null;
  private photoEntityId: number | null = null;

  private loadPhotosForCity(cityId: number): void {
    this.photoEntityType = 'cities';
    this.photoEntityId = cityId;
    this.photosPage.set(1);
    this.fetchPhotosPage(1);
  }

  private loadPhotosForAttraction(attractionId: number): void {
    this.photoEntityType = 'attractions';
    this.photoEntityId = attractionId;
    this.photosPage.set(1);
    this.fetchPhotosPage(1);
  }

  private fetchPhotosPage(page: number): void {
    if (!this.photoEntityType || !this.photoEntityId) return;
    this.photosLoading.set(true);

    const fetch$ = this.photoEntityType === 'cities'
      ? this.photoService.getCityPhotos(this.photoEntityId, page, this.photosPerPage)
      : this.photoService.getAttractionPhotos(this.photoEntityId, page, this.photosPerPage);

    fetch$.pipe(
      takeUntil(this.destroy$),
      tap((res) => {
        this.photos.set(res.photos);
        this.photosTotal.set(res.total);
        this.photosPage.set(res.page);
      }),
      finalize(() => this.photosLoading.set(false)),
    ).subscribe();
  }

  // --- Lightbox ---

  ngAfterViewChecked(): void {
    // Auto-focus the lightbox dialog once it renders
    if (this.lightboxNeedsFocus && this.lightboxDialogRef) {
      this.lightboxDialogRef.nativeElement.focus();
      this.lightboxNeedsFocus = false;
    }
  }

  openLightbox(index: number): void {
    this.lightboxTriggerEl = document.activeElement as HTMLElement | null;
    this.lightboxImageLoading.set(true);
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
    this.lightboxNeedsFocus = true;
    this.preloadAdjacentImages(index);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
    // Restore focus to the element that opened the lightbox
    if (this.lightboxTriggerEl) {
      setTimeout(() => this.lightboxTriggerEl?.focus());
      this.lightboxTriggerEl = null;
    }
  }

  lightboxPrev(): void {
    const total = this.photos().length;
    if (total === 0) return;
    this.navigateLightbox((this.lightboxIndex() - 1 + total) % total);
  }

  lightboxNext(): void {
    const total = this.photos().length;
    if (total === 0) return;
    this.navigateLightbox((this.lightboxIndex() + 1) % total);
  }

  private navigateLightbox(newIndex: number): void {
    if (newIndex === this.lightboxIndex()) return;
    this.lightboxImageLoading.set(true);
    this.lightboxIndex.set(newIndex);
    this.preloadAdjacentImages(newIndex);
  }

  /** Preload the next and previous images so they display instantly */
  private preloadAdjacentImages(currentIndex: number): void {
    const all = this.photos();
    const total = all.length;
    if (total <= 1) return;

    const indices = [
      (currentIndex + 1) % total,
      (currentIndex - 1 + total) % total,
    ];
    for (const i of indices) {
      const img = new Image();
      img.src = all[i].url;
    }
  }

  // --- Photo Pagination ---

  photosPagePrev(): void {
    const prev = this.photosPage() - 1;
    if (prev >= 1) {
      this.fetchPhotosPage(prev);
    }
  }

  photosPageNext(): void {
    const next = this.photosPage() + 1;
    if (next <= this.totalPhotoPages()) {
      this.fetchPhotosPage(next);
    }
  }

  photosGoToPage(page: number): void {
    if (page >= 1 && page <= this.totalPhotoPages() && page !== this.photosPage()) {
      this.fetchPhotosPage(page);
    }
  }

  onLightboxImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const maxW = window.innerWidth * 0.85;
    const maxH = window.innerHeight * 0.78;
    const scale = Math.min(1, maxW / natW, maxH / natH);

    this.lightboxImageSize.set({
      width: Math.round(natW * scale),
      height: Math.round(natH * scale),
    });
    this.lightboxImageLoading.set(false);
  }

  onLightboxKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        event.preventDefault();
        break;
      case 'ArrowLeft':
        this.lightboxPrev();
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.lightboxNext();
        event.preventDefault();
        break;
      case 'Home':
        this.navigateLightbox(0);
        event.preventDefault();
        break;
      case 'End':
        this.navigateLightbox(Math.max(0, this.photos().length - 1));
        event.preventDefault();
        break;
      case 'Tab':
        // Trap focus within the lightbox
        this.trapFocus(event);
        break;
    }
  }

  /** Keep Tab / Shift+Tab cycling within the lightbox dialog */
  private trapFocus(event: KeyboardEvent): void {
    const dialog = this.lightboxDialogRef?.nativeElement;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first || document.activeElement === dialog) {
        last.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.lightboxOpen()) {
      // Avoid double-handling: the lightbox overlay already listens for
      // keydown via the template binding. Only handle here if the event
      // originated outside the lightbox dialog (e.g. focus escaped).
      const dialog = this.lightboxDialogRef?.nativeElement;
      if (dialog && dialog.contains(event.target as Node)) {
        return;
      }
      this.onLightboxKeydown(event);
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }
}

