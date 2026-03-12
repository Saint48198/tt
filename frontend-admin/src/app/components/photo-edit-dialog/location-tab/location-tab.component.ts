import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MapComponent, MapMarker } from '@shared/components';
import { CitiesService } from '../../../services/cities.service';
import { CountriesService } from '../../../services/countries.service';
import { StatesService } from '../../../services/states.service';
import { City, Country, State } from '../../../interfaces';
import { switchMap, of, forkJoin } from 'rxjs';
import { PhotoEditStateService } from '../photo-edit-state.service';

export interface ReverseGeoResult {
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface CitySelectedEvent {
  cityId: number;
  cityName: string;
  stateId: number | null;
  stateName: string | null;
}

@Component({
  selector: 'app-location-tab',
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MapComponent,
  ],
  templateUrl: './location-tab.component.html',
  styleUrl: './location-tab.component.scss',
})
export class LocationTabComponent implements AfterViewInit, OnDestroy {
  @ViewChild(MapComponent) private mapComponent?: MapComponent;

  private readonly el = inject(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly citiesService = inject(CitiesService);
  private readonly countriesService = inject(CountriesService);
  private readonly statesService = inject(StatesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = inject(PhotoEditStateService);

  private observer?: IntersectionObserver;

  // Reverse geocode state
  reverseGeo = signal<ReverseGeoResult | null>(null);
  reverseGeoLoading = signal(false);
  reverseGeoError = signal<string | null>(null);
  matchedCities = signal<City[]>([]);
  matchingCities = signal(false);
  assigned = signal(false);

  // Edit location state
  editingLocation = signal(false);
  placingPin = signal(false);
  latInput = signal<string>('');
  lngInput = signal<string>('');

  // Country / state lookup for creating city
  private resolvedCountry = signal<Country | null>(null);
  private resolvedState = signal<State | null>(null);
  private allStates = signal<State[]>([]);
  creatingCity = signal(false);
  creatingState = signal(false);
  stateCreated = signal(false);

  canAddCity = computed(() => {
    const geo = this.reverseGeo();
    return (
      geo?.city != null &&
      geo.city !== 'Unknown City' &&
      this.matchedCities().length === 0 &&
      !this.matchingCities() &&
      this.resolvedCountry() != null
    );
  });

  canAddState = computed(() => {
    const geo = this.reverseGeo();
    const country = this.resolvedCountry();
    if (!geo?.state || geo.state === 'Unknown State' || !country) return false;
    const stateName = geo.state;
    const name = country.name.toLowerCase();
    const isUsOrCanada =
      name.includes('united states') || name === 'usa' || name === 'us' || name.includes('canada');
    if (!isUsOrCanada) return false;
    const match = this.allStates().find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase() && s.country_id === country.id
    );
    return !match && !this.stateCreated();
  });

  hasLocation = computed(() => this.state.latitude() != null && this.state.longitude() != null);

  mapMarkers = computed<MapMarker[]>(() => {
    const lat = this.state.latitude();
    const lng = this.state.longitude();
    if (lat != null && lng != null) {
      const cap = this.state.caption() || 'Photo';
      return [
        {
          lat,
          lng,
          title: cap,
          popup: `<b>${cap}</b><br/>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
        },
      ];
    }
    return [];
  });

  mapCenter = computed<[number, number]>(() => {
    const lat = this.state.latitude();
    const lng = this.state.longitude();
    if (lat != null && lng != null) {
      return [lat, lng];
    }
    return [39.8283, -98.5795];
  });

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setTimeout(() => this.mapComponent?.invalidateSize(), 50);
          if (this.hasLocation() && !this.reverseGeo() && !this.reverseGeoLoading()) {
            this.lookupLocation();
          }
        }
      },
      { threshold: 0.1 }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  lookupLocation(): void {
    const lat = this.state.latitude();
    const lng = this.state.longitude();
    if (lat == null || lng == null) return;

    this.reverseGeoLoading.set(true);
    this.reverseGeoError.set(null);
    this.reverseGeo.set(null);
    this.matchedCities.set([]);
    this.assigned.set(false);
    this.resolvedCountry.set(null);
    this.resolvedState.set(null);
    this.stateCreated.set(false);

    this.http
      .post<{ city: string; state: string; country: string }>('/api/geocode', {
        latitude: lat,
        longitude: lng,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.reverseGeo.set({
            city: res.city || null,
            state: res.state || null,
            country: res.country || null,
          });
          this.reverseGeoLoading.set(false);

          if (res.city && res.city !== 'Unknown City') {
            this.findMatchingCities(res.city);
          }

          if (res.country && res.country !== 'Unknown Country') {
            this.resolveCountryAndStates(res.country);
          }
        },
        error: () => {
          this.reverseGeoError.set('Failed to look up location');
          this.reverseGeoLoading.set(false);
        },
      });
  }

  private findMatchingCities(name: string): void {
    this.matchingCities.set(true);
    this.citiesService
      .getCities({ search: name, page: 1, limit: 10 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.matchedCities.set(res.cities);
          this.matchingCities.set(false);
        },
        error: () => {
          this.matchedCities.set([]);
          this.matchingCities.set(false);
        },
      });
  }

  assignCity(city: City): void {
    this.state.cityId.set(city.id);
    if (city.state_id != null) {
      this.state.stateId.set(city.state_id);
    }
    this.assigned.set(true);
    const stateSuffix = city.state_name ? `, state set to "${city.state_name}"` : '';
    this.snackBar.open(`City set to "${city.name}"${stateSuffix}`, 'Close', { duration: 3000 });
  }

  /**
   * Common aliases: maps Nominatim country names to DB country names.
   */
  private static readonly COUNTRY_ALIASES: Record<string, string[]> = {
    'united states of america': ['united states', 'usa', 'us'],
    'united states': ['united states of america', 'usa', 'us'],
    'united kingdom of great britain and northern ireland': [
      'united kingdom',
      'uk',
      'great britain',
    ],
    'united kingdom': [
      'united kingdom of great britain and northern ireland',
      'uk',
      'great britain',
    ],
    'republic of korea': ['south korea', 'korea'],
    'south korea': ['republic of korea', 'korea'],
    czechia: ['czech republic'],
    'czech republic': ['czechia'],
    "côte d'ivoire": ['ivory coast'],
    'ivory coast': ["côte d'ivoire"],
    'russian federation': ['russia'],
    russia: ['russian federation'],
  };

  private matchCountryByName(name: string, countries: Country[]): Country | undefined {
    const detected = name.toLowerCase();

    // 1. Exact match
    const exact = countries.find((c) => c.name.toLowerCase() === detected);
    if (exact) return exact;

    // 2. Check aliases
    const aliases = LocationTabComponent.COUNTRY_ALIASES[detected] || [];
    for (const alias of aliases) {
      const match = countries.find((c) => c.name.toLowerCase() === alias);
      if (match) return match;
    }

    // 3. Contains-based match (one contains the other)
    return countries.find(
      (c) => detected.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(detected)
    );
  }

  private resolveCountryAndStates(countryName: string): void {
    forkJoin({
      countries: this.countriesService.getAllCountries('name'),
      states: this.statesService.getAllStates('name'),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ countries, states }) => {
          const match = this.matchCountryByName(countryName, countries.countries);
          this.resolvedCountry.set(match || null);
          this.allStates.set(states.states);

          if (match) {
            const geo = this.reverseGeo();
            if (geo?.state && geo.state !== 'Unknown State') {
              const geoStateName = geo.state;
              const stateMatch = states.states.find(
                (s) =>
                  s.name.toLowerCase() === geoStateName.toLowerCase() && s.country_id === match.id
              );
              this.resolvedState.set(stateMatch || null);
            }
          }
        },
      });
  }

  addState(): void {
    const geo = this.reverseGeo();
    const country = this.resolvedCountry();
    if (!geo?.state || !country) return;
    const geoStateName = geo.state;

    this.creatingState.set(true);
    this.statesService
      .createState({ name: geoStateName, country_id: country.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.creatingState.set(false);
          this.stateCreated.set(true);
          if (res.id) {
            const newState: State = {
              id: res.id,
              name: geoStateName,
              country_id: country.id,
              country_name: country.name,
            };
            this.resolvedState.set(newState);
            this.allStates.update((list) => [...list, newState]);
          }
        },
        error: () => {
          this.creatingState.set(false);
        },
      });
  }

  addCity(): void {
    const geo = this.reverseGeo();
    const country = this.resolvedCountry();
    const lat = this.state.latitude();
    const lng = this.state.longitude();
    if (!geo?.city || !country || lat == null || lng == null) return;

    this.creatingCity.set(true);
    const resolvedState = this.resolvedState();
    this.citiesService
      .createCity({
        name: geo.city,
        lat,
        lng,
        country_id: country.id,
        state_id: resolvedState?.id,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((res) => {
          if (res.id) {
            return this.citiesService.getCity(res.id);
          }
          return of(null);
        })
      )
      .subscribe({
        next: (city) => {
          this.creatingCity.set(false);
          if (city) {
            this.matchedCities.set([city]);
            this.assignCity(city);
          }
        },
        error: () => {
          this.creatingCity.set(false);
        },
      });
  }

  // ── Location editing ──

  startEditLocation(): void {
    const lat = this.state.latitude();
    const lng = this.state.longitude();
    this.latInput.set(lat != null ? lat.toFixed(6) : '');
    this.lngInput.set(lng != null ? lng.toFixed(6) : '');
    this.editingLocation.set(true);
    this.placingPin.set(false);
  }

  cancelEditLocation(): void {
    this.editingLocation.set(false);
    this.placingPin.set(false);
  }

  applyManualCoords(): void {
    const lat = parseFloat(this.latInput());
    const lng = parseFloat(this.lngInput());
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.snackBar.open('Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180.', 'Close', {
        duration: 4000,
      });
      return;
    }
    this.state.latitude.set(lat);
    this.state.longitude.set(lng);
    this.editingLocation.set(false);
    this.placingPin.set(false);
    // Reset reverse geocode so it re-runs
    this.reverseGeo.set(null);
    this.reverseGeoError.set(null);
    this.assigned.set(false);
    this.matchedCities.set([]);
    this.snackBar.open('Location updated', 'Close', { duration: 2000 });
    // Trigger reverse geocode lookup
    setTimeout(() => this.lookupLocation(), 300);
  }

  togglePlacePin(): void {
    this.placingPin.update((v) => !v);
  }

  onMapClick(event: { lat: number; lng: number }): void {
    if (!this.placingPin() && !this.editingLocation()) return;
    this.latInput.set(event.lat.toFixed(6));
    this.lngInput.set(event.lng.toFixed(6));
    // Auto-apply when clicking on map
    this.state.latitude.set(event.lat);
    this.state.longitude.set(event.lng);
    this.placingPin.set(false);
    this.editingLocation.set(false);
    // Reset reverse geocode
    this.reverseGeo.set(null);
    this.reverseGeoError.set(null);
    this.assigned.set(false);
    this.matchedCities.set([]);
    this.snackBar.open('Location set from map', 'Close', { duration: 2000 });
    setTimeout(() => this.lookupLocation(), 300);
  }

  clearLocation(): void {
    this.state.latitude.set(null);
    this.state.longitude.set(null);
    this.reverseGeo.set(null);
    this.reverseGeoError.set(null);
    this.matchedCities.set([]);
    this.assigned.set(false);
    this.editingLocation.set(false);
    this.placingPin.set(false);
    this.snackBar.open('Location cleared', 'Close', { duration: 2000 });
  }
}
