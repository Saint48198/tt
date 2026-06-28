import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of, combineLatest } from 'rxjs';
import { switchMap, tap, skip } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CitiesService } from '../../../services/cities.service';
import { AttractionsService } from '../../../services/attractions.service';
import { StatesService } from '../../../services/states.service';
import { PhotoEditStateService } from '../photo-edit-state.service';
import {
  ChangeCountryDialogComponent,
  ChangeCountryDialogResult,
} from './change-country-dialog.component';

export interface EntityOption {
  id: number;
  name: string;
}

interface CityOption extends EntityOption {
  state_id?: number;
  state_name?: string;
}

// No longer restricted to specific countries — states are loaded for any country that has them in the DB

@Component({
  selector: 'app-entity-tab',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './entity-tab.component.html',
  styleUrl: './entity-tab.component.scss',
})
export class EntityTabComponent implements OnInit {
  private readonly citiesService = inject(CitiesService);
  private readonly attractionsService = inject(AttractionsService);
  private readonly statesService = inject(StatesService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = inject(PhotoEditStateService);

  // City combobox
  cityInputValue = signal('');
  private allCities = signal<CityOption[]>([]);
  filteredCities = computed(() => {
    const q = this.cityInputValue().toLowerCase();
    const all = this.allCities();
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  // State combobox
  stateInputValue = signal('');
  private allStates = signal<EntityOption[]>([]);
  loadingStates = signal(false);
  allStatesCount = computed(() => this.allStates().length);
  filteredStates = computed(() => {
    const q = this.stateInputValue().toLowerCase();
    const all = this.allStates();
    return q ? all.filter((s) => s.name.toLowerCase().includes(q)) : all;
  });

  // Attraction combobox
  attractionInputValue = signal('');
  private allAttractions = signal<EntityOption[]>([]);
  filteredAttractions = computed(() => {
    const q = this.attractionInputValue().toLowerCase();
    const all = this.allAttractions();
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all;
  });

  // Loading indicator for the combined cities+attractions load
  loadingEntities = signal(false);

  constructor() {
    // Reactive pipeline: whenever countryId OR stateId changes, reload cities + attractions.
    // (Listening to stateId alone misses country changes where stateId stays null,
    //  e.g. switching to a country whose photos have no assigned state.)
    combineLatest([toObservable(this.state.countryId), toObservable(this.state.stateId)])
      .pipe(
        tap(() => this.loadingEntities.set(true)),
        switchMap(([countryId, stateId]) => {
          const cityParams: {
            country_id?: number;
            state_id?: number;
            page: number;
            limit: number;
          } = {
            page: 1,
            limit: 500,
          };
          const attractionParams: {
            country_id?: number;
            state_id?: number;
            page: number;
            limit: number;
          } = {
            page: 1,
            limit: 500,
          };
          if (countryId) {
            cityParams.country_id = countryId;
            attractionParams.country_id = countryId;
          }
          if (stateId) {
            cityParams.state_id = stateId;
            attractionParams.state_id = stateId;
          }
          return forkJoin({
            cities: this.citiesService.getCities(cityParams),
            attractions: this.attractionsService.getAttractions(attractionParams),
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ cities, attractions }) => {
          this.allCities.set(
            cities.cities.map((c) => ({
              id: c.id,
              name: c.name,
              state_id: c.state_id,
              state_name: c.state_name,
            }))
          );
          this.allAttractions.set(attractions.attractions.map((a) => ({ id: a.id, name: a.name })));
          this.syncInputValues();
          this.loadingEntities.set(false);
        },
        error: () => {
          this.allCities.set([]);
          this.allAttractions.set([]);
          this.loadingEntities.set(false);
        },
      });

    // Sync cityInputValue when cityId changes externally (e.g. from location tab)
    toObservable(this.state.cityId)
      .pipe(
        skip(1), // skip initial emission; ngOnInit handles the initial value
        switchMap((cityId) => {
          if (cityId == null) {
            this.cityInputValue.set('');
            return of(null);
          }
          // Try to find in already-loaded cities first
          const existing = this.allCities().find((c) => c.id === cityId);
          if (existing) {
            this.cityInputValue.set(existing.name);
            return of(null);
          }
          // Fetch from API if not in the list
          return this.citiesService.getCity(cityId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((city) => {
        if (city) {
          this.cityInputValue.set(city.name);
        }
      });
  }

  ngOnInit(): void {
    const photo = this.state.photo();
    this.cityInputValue.set(photo.city_name || '');
    this.attractionInputValue.set(photo.attraction_name || '');
    this.stateInputValue.set(photo.state_name || '');
    this.loadStates();
  }

  /**
   * After cities/attractions load, sync input values to match any selected IDs.
   * Handles the case where stateId was set (e.g. from keyword auto-populate)
   * after initial input values were already set from the photo.
   */
  private syncInputValues(): void {
    const cityId = this.state.cityId();
    if (cityId != null) {
      const match = this.allCities().find((c) => c.id === cityId);
      if (match && this.cityInputValue() !== match.name) {
        this.cityInputValue.set(match.name);
      }
    }
    const attractionId = this.state.attractionId();
    if (attractionId != null) {
      const match = this.allAttractions().find((a) => a.id === attractionId);
      if (match && this.attractionInputValue() !== match.name) {
        this.attractionInputValue.set(match.name);
      }
    }
    const stateId = this.state.stateId();
    if (stateId != null) {
      const match = this.allStates().find((s) => s.id === stateId);
      if (match && this.stateInputValue() !== match.name) {
        this.stateInputValue.set(match.name);
      }
    }
  }

  private loadStates(): void {
    const cid = this.state.countryId();
    if (!cid) {
      this.allStates.set([]);
      return;
    }

    this.loadingStates.set(true);
    this.statesService
      .getAllStates('name')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const states = res.states.filter((s) => Number(s.country_id) === Number(cid));
          this.allStates.set(states.map((s) => ({ id: s.id, name: s.name })));
          this.loadingStates.set(false);
          this.syncInputValues();
        },
        error: () => {
          this.allStates.set([]);
          this.loadingStates.set(false);
        },
      });
  }

  // ── City combobox ──
  onCityInput(value: string): void {
    this.cityInputValue.set(value);
    if (!value) {
      this.state.cityId.set(null);
    }
  }

  onCitySelected(option: CityOption): void {
    this.state.cityId.set(option.id);
    this.cityInputValue.set(option.name);
    // Auto-populate state if the city has one
    if (option.state_id) {
      this.state.stateId.set(option.state_id);
      this.stateInputValue.set(option.state_name || '');
    }
  }

  clearCity(): void {
    this.state.cityId.set(null);
    this.cityInputValue.set('');
  }

  displayCityFn = (option: EntityOption): string => option?.name ?? '';

  // ── State combobox ──
  onStateInput(value: string): void {
    this.stateInputValue.set(value);
    if (!value) {
      this.state.stateId.set(null);
    }
  }

  onStateSelected(option: EntityOption): void {
    this.state.stateId.set(option.id);
    this.stateInputValue.set(option.name);
  }

  clearState(): void {
    this.state.stateId.set(null);
    this.stateInputValue.set('');
  }

  displayStateFn = (option: EntityOption): string => option?.name ?? '';

  // ── Attraction combobox ──
  onAttractionInput(value: string): void {
    this.attractionInputValue.set(value);
    if (!value) {
      this.state.attractionId.set(null);
    }
  }

  onAttractionSelected(option: EntityOption): void {
    this.state.attractionId.set(option.id);
    this.attractionInputValue.set(option.name);
  }

  clearAttraction(): void {
    this.state.attractionId.set(null);
    this.attractionInputValue.set('');
  }

  displayAttractionFn = (option: EntityOption): string => option?.name ?? '';

  // ── Change Country ──
  openChangeCountry(): void {
    this.dialog
      .open(ChangeCountryDialogComponent, {
        width: '400px',
        maxHeight: '80vh',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: ChangeCountryDialogResult | undefined) => {
        if (result?.changed && result.countryId != null && result.countryName) {
          this.state.countryId.set(result.countryId);
          this.state.countryName.set(result.countryName);
          // Clear dependent entity selections — stateId change triggers cities+attractions reload
          this.state.cityId.set(null);
          this.state.attractionId.set(null);
          this.cityInputValue.set('');
          this.attractionInputValue.set('');
          this.stateInputValue.set('');
          this.state.stateId.set(null);
          this.loadStates();
        }
      });
  }
}
