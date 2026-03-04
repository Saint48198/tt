import { Component, DestroyRef, effect, inject, signal, computed, model, OnInit, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CitiesService } from '../../../services/cities.service';
import { AttractionsService } from '../../../services/attractions.service';
import { StatesService } from '../../../services/states.service';

export interface EntityOption {
  id: number;
  name: string;
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
  ],
  templateUrl: './entity-tab.component.html',
  styleUrl: './entity-tab.component.scss',
})
export class EntityTabComponent implements OnInit {
  private readonly citiesService = inject(CitiesService);
  private readonly attractionsService = inject(AttractionsService);
  private readonly statesService = inject(StatesService);
  private readonly destroyRef = inject(DestroyRef);

  countryId = input<number | null>(null);
  initialCityName = input<string>('');
  initialAttractionName = input<string>('');
  initialStateName = input<string>('');

  cityId = model.required<number | null>();
  attractionId = model.required<number | null>();
  stateId = model.required<number | null>();

  // City combobox
  cityInputValue = signal('');
  private allCities = signal<EntityOption[]>([]);
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
    // Sync city input display when cityId is set externally (e.g. from location tab)
    effect(() => {
      const id = this.cityId();
      const cities = this.allCities();
      if (id != null && cities.length > 0) {
        const match = cities.find((c) => c.id === id);
        if (match) {
          if (this.cityInputValue() !== match.name) {
            this.cityInputValue.set(match.name);
          }
          lastReloadedForCityId = null;
        } else if (lastReloadedForCityId !== id) {
          // City not in loaded list (newly created) — reload once
          lastReloadedForCityId = id;
          this.loadCities();
        }
      }
    });

    let lastReloadedForStateId: number | null = null;
    // Sync state input display when stateId is set externally (e.g. from location tab)
    effect(() => {
      const id = this.stateId();
      const states = this.allStates();
      if (id != null && states.length > 0) {
        const match = states.find((s) => s.id === id);
        if (match) {
          if (this.stateInputValue() !== match.name) {
            this.stateInputValue.set(match.name);
          }
          lastReloadedForStateId = null;
        } else if (lastReloadedForStateId !== id) {
          // State not in loaded list (newly created) — reload once
          lastReloadedForStateId = id;
          this.loadStates();
        }
      }
    });
  }

  ngOnInit(): void {
    this.cityInputValue.set(this.initialCityName() || '');
    this.attractionInputValue.set(this.initialAttractionName() || '');
    this.stateInputValue.set(this.initialStateName() || '');
    this.loadCities();
    this.loadAttractions();
    this.loadStates();
  }

  private loadCities(): void {
    this.loadingCities.set(true);
    const countryId = this.countryId();
    const params = countryId
      ? { country_id: countryId, page: 1, limit: 500 }
      : { page: 1, limit: 500 };
    this.citiesService.getCities(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.allCities.set(res.cities.map((c) => ({ id: c.id, name: c.name })));
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
    const countryId = this.countryId();
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
        const cid = this.countryId();
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
      this.cityId.set(null);
    }
  }

  onCitySelected(option: EntityOption): void {
    this.cityId.set(option.id);
    this.cityInputValue.set(option.name);
  }

  clearCity(): void {
    this.cityId.set(null);
    this.cityInputValue.set('');
  }

  displayCityFn = (option: EntityOption): string => option?.name ?? '';

  // ── State combobox ──
  onStateInput(value: string): void {
    this.stateInputValue.set(value);
    if (!value) {
      this.stateId.set(null);
    }
  }

  onStateSelected(option: EntityOption): void {
    this.stateId.set(option.id);
    this.stateInputValue.set(option.name);
  }

  clearState(): void {
    this.stateId.set(null);
    this.stateInputValue.set('');
  }

  displayStateFn = (option: EntityOption): string => option?.name ?? '';

  // ── Attraction combobox ──
  onAttractionInput(value: string): void {
    this.attractionInputValue.set(value);
    if (!value) {
      this.attractionId.set(null);
    }
  }

  onAttractionSelected(option: EntityOption): void {
    this.attractionId.set(option.id);
    this.attractionInputValue.set(option.name);
  }

  clearAttraction(): void {
    this.attractionId.set(null);
    this.attractionInputValue.set('');
  }

  displayAttractionFn = (option: EntityOption): string => option?.name ?? '';
}


