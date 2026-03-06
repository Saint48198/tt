import { Component, DestroyRef, effect, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ChangeCountryDialogComponent, ChangeCountryDialogResult } from './change-country-dialog.component';

export interface EntityOption {
  id: number;
  name: string;
}

interface CityOption extends EntityOption {
  state_id?: number;
  state_name?: string;
}

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
  loadingCities = signal(false);
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
  loadingAttractions = signal(false);
  filteredAttractions = computed(() => {
    const q = this.attractionInputValue().toLowerCase();
    const all = this.allAttractions();
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all;
  });

  constructor() {
    let lastReloadedForCityId: number | null = null;
    effect(() => {
      const id = this.state.cityId();
      const cities = this.allCities();
      if (id != null && cities.length > 0) {
        const match = cities.find((c) => c.id === id);
        if (match) {
          if (this.cityInputValue() !== match.name) {
            this.cityInputValue.set(match.name);
          }
          lastReloadedForCityId = null;
        } else if (lastReloadedForCityId !== id) {
          lastReloadedForCityId = id;
          this.loadCities();
        }
      }
    });

    let lastReloadedForStateId: number | null = null;
    effect(() => {
      const id = this.state.stateId();
      const states = this.allStates();
      if (id != null && states.length > 0) {
        const match = states.find((s) => s.id === id);
        if (match) {
          if (this.stateInputValue() !== match.name) {
            this.stateInputValue.set(match.name);
          }
          lastReloadedForStateId = null;
        } else if (lastReloadedForStateId !== id) {
          lastReloadedForStateId = id;
          this.loadStates();
        }
      }
    });
  }

  ngOnInit(): void {
    const photo = this.state.photo();
    this.cityInputValue.set(photo.city_name || '');
    this.attractionInputValue.set(photo.attraction_name || '');
    this.stateInputValue.set(photo.state_name || '');
    this.loadCities();
    this.loadAttractions();
    this.loadStates();
  }

  private loadCities(): void {
    this.loadingCities.set(true);
    const countryId = this.state.countryId();
    const params = countryId
      ? { country_id: countryId, page: 1, limit: 500 }
      : { page: 1, limit: 500 };
    this.citiesService.getCities(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.allCities.set(res.cities.map((c) => ({ id: c.id, name: c.name, state_id: c.state_id, state_name: c.state_name })));
        this.loadingCities.set(false);
      },
      error: () => {
        this.allCities.set([]);
        this.loadingCities.set(false);
      },
    });
  }

  private loadAttractions(): void {
    this.loadingAttractions.set(true);
    const countryId = this.state.countryId();
    const params = countryId
      ? { country_id: countryId, page: 1, limit: 500 }
      : { page: 1, limit: 500 };
    this.attractionsService.getAttractions(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.allAttractions.set(res.attractions.map((a) => ({ id: a.id, name: a.name })));
        this.loadingAttractions.set(false);
      },
      error: () => {
        this.allAttractions.set([]);
        this.loadingAttractions.set(false);
      },
    });
  }

  private loadStates(): void {
    this.loadingStates.set(true);
    this.statesService.getAllStates('name').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const cid = this.state.countryId();
        const states = cid
          ? res.states.filter((s) => Number(s.country_id) === Number(cid))
          : res.states;
        this.allStates.set(states.map((s) => ({ id: s.id, name: s.name })));
        this.loadingStates.set(false);
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
    this.dialog.open(ChangeCountryDialogComponent, {
      width: '400px',
      maxHeight: '80vh',
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: ChangeCountryDialogResult | undefined) => {
        if (result?.changed && result.countryId != null && result.countryName) {
          this.state.countryId.set(result.countryId);
          this.state.countryName.set(result.countryName);
          // Clear dependent entity selections since country changed
          this.state.cityId.set(null);
          this.state.stateId.set(null);
          this.state.attractionId.set(null);
          this.cityInputValue.set('');
          this.stateInputValue.set('');
          this.attractionInputValue.set('');
          // Reload entity lists for the new country
          this.loadCities();
          this.loadAttractions();
          this.loadStates();
        }
      });
  }
}

