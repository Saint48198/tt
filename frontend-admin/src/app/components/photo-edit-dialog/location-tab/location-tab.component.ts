import {
  AfterViewInit, Component, computed, DestroyRef, ElementRef,
  inject, input, OnDestroy, output, signal, ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MapComponent, MapMarker } from '@shared/components';
import { CitiesService } from '../../../services/cities.service';
import { CountriesService } from '../../../services/countries.service';
import { StatesService } from '../../../services/states.service';
import { City, Country, State } from '../../../interfaces';
import { switchMap, of, forkJoin } from 'rxjs';

export interface ReverseGeoResult {
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface CitySelectedEvent {
  cityId: number;
  cityName: string;
}

@Component({
  selector: 'app-location-tab',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MapComponent,
  ],
  templateUrl: './location-tab.component.html',
  styleUrl: './location-tab.component.scss',
})
export class LocationTabComponent implements AfterViewInit, OnDestroy {
  @ViewChild(MapComponent) private mapComponent?: MapComponent;

  latitude = input<number | null>(null);
  longitude = input<number | null>(null);
  caption = input<string>('');
  currentCityId = input<number | null>(null);

  citySelected = output<CitySelectedEvent>();

  private readonly el = inject(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly citiesService = inject(CitiesService);
  private readonly countriesService = inject(CountriesService);
  private readonly statesService = inject(StatesService);
  private readonly destroyRef = inject(DestroyRef);

  private observer?: IntersectionObserver;

  // Reverse geocode state
  reverseGeo = signal<ReverseGeoResult | null>(null);
  reverseGeoLoading = signal(false);
  reverseGeoError = signal<string | null>(null);
  matchedCities = signal<City[]>([]);
  matchingCities = signal(false);
  assigned = signal(false);

  // Country / state lookup for creating city
  private resolvedCountry = signal<Country | null>(null);
  private resolvedState = signal<State | null>(null);
  private allStates = signal<State[]>([]);
  creatingCity = signal(false);
  creatingState = signal(false);
  stateCreated = signal(false);

  /** True when the geocoded city name is valid (not "Unknown City") */
  canAddCity = computed(() => {
    const geo = this.reverseGeo();
    return geo?.city != null
      && geo.city !== 'Unknown City'
      && this.matchedCities().length === 0
      && !this.matchingCities()
      && this.resolvedCountry() != null;
  });

  /** True when the geocoded country is US or Canada and state is present but not in the DB */
  canAddState = computed(() => {
    const geo = this.reverseGeo();
    const country = this.resolvedCountry();
    if (!geo?.state || geo.state === 'Unknown State' || !country) return false;
    const name = country.name.toLowerCase();
    const isUsOrCanada = name.includes('united states') || name === 'usa' || name === 'us'
      || name.includes('canada');
    if (!isUsOrCanada) return false;
    // Check if state already exists
    const match = this.allStates().find(
      (s) => s.name.toLowerCase() === geo.state!.toLowerCase() && s.country_id === country.id,
    );
    return !match && !this.stateCreated();
  });

  hasLocation = computed(() => this.latitude() != null && this.longitude() != null);

  mapMarkers = computed<MapMarker[]>(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat != null && lng != null) {
      const cap = this.caption() || 'Photo';
      return [{
        lat,
        lng,
        title: cap,
        popup: `<b>${cap}</b><br/>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
      }];
    }
    return [];
  });

  mapCenter = computed<[number, number]>(() => {
    const lat = this.latitude();
    const lng = this.longitude();
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
          // Auto-lookup on first visibility if we have coordinates
          if (this.hasLocation() && !this.reverseGeo() && !this.reverseGeoLoading()) {
            this.lookupLocation();
          }
        }
      },
      { threshold: 0.1 },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  lookupLocation(): void {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat == null || lng == null) return;

    this.reverseGeoLoading.set(true);
    this.reverseGeoError.set(null);
    this.reverseGeo.set(null);
    this.matchedCities.set([]);
    this.assigned.set(false);
    this.resolvedCountry.set(null);
    this.resolvedState.set(null);
    this.stateCreated.set(false);

    this.http.post<{ city: string; state: string; country: string }>('/api/geocode', {
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

          // Resolve country and states for potential city/state creation
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
    this.citiesService.getCities({ search: name, page: 1, limit: 10 })
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
    this.citySelected.emit({ cityId: city.id, cityName: city.name });
    this.assigned.set(true);
  }

  private resolveCountryAndStates(countryName: string): void {
    forkJoin({
      countries: this.countriesService.getAllCountries('name'),
      states: this.statesService.getAllStates('name'),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ countries, states }) => {
          const match = countries.countries.find(
            (c) => c.name.toLowerCase() === countryName.toLowerCase(),
          );
          this.resolvedCountry.set(match || null);
          this.allStates.set(states.states);

          // Also resolve the state if one matches
          if (match) {
            const geo = this.reverseGeo();
            if (geo?.state && geo.state !== 'Unknown State') {
              const stateMatch = states.states.find(
                (s) => s.name.toLowerCase() === geo.state!.toLowerCase() && s.country_id === match.id,
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

    this.creatingState.set(true);
    this.statesService.createState({ name: geo.state, country_id: country.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.creatingState.set(false);
          this.stateCreated.set(true);
          if (res.id) {
            const newState: State = {
              id: res.id,
              name: geo.state!,
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
    const lat = this.latitude();
    const lng = this.longitude();
    if (!geo?.city || !country || lat == null || lng == null) return;

    this.creatingCity.set(true);
    const state = this.resolvedState();
    this.citiesService.createCity({
      name: geo.city,
      lat,
      lng,
      country_id: country.id,
      state_id: state?.id,
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((res) => {
          if (res.id) {
            return this.citiesService.getCity(res.id);
          }
          return of(null);
        }),
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
}


