import { Component, DestroyRef, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialogModule } from '@angular/material/dialog';
import { TripsService } from '../../services/trips.service';
import { CountriesService } from '../../services/countries.service';
import { CitiesService } from '../../services/cities.service';
import { GeocodeService } from '../../services/geocode.service';
import { HasUnsavedChanges } from '@shared/services';
import {
  Trip,
  Country,
  City,
  AnyPlanItem,
  PlanItemType,
  PlanFlight,
  PlanAttraction,
  PlanAccommodation,
  PlanCarRental,
  PlanFerry,
  TrainPlan,
} from '../../interfaces';

@Component({
  selector: 'app-trip-edit',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatMenuModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatTooltipModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatDialogModule,
  ],
  templateUrl: './trip-edit.component.html',
  styleUrl: './trip-edit.component.scss',
  providers: [DatePipe],
})
export class TripEditComponent implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);
  private readonly countriesService = inject(CountriesService);
  private readonly citiesService = inject(CitiesService);
  private readonly geocodeService = inject(GeocodeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly datePipe = inject(DatePipe);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  loading = signal(false);
  saving = signal(false);
  tripId!: number;
  countries = signal<Country[]>([]);
  cities = signal<City[]>([]);
  planItems = signal<AnyPlanItem[]>([]);
  private saved = false;
  private planDirty = signal(false);

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    if (this.saved) return false;
    return (this.form?.dirty ?? false) || this.planDirty();
  }

  // Inline add new country
  addingNewCountryFor = signal<string | null>(null); // tracks which country field is adding
  newCountryName = signal('');
  newCountryLat = signal<number | null>(null);
  newCountryLng = signal<number | null>(null);
  geocodingCountry = signal(false);
  savingCountry = signal(false);

  // Inline add new city
  addingNewCityFor = signal<string | null>(null);
  newCityName = signal('');
  newCityCountryId = signal<number | null>(null);
  newCityLat = signal<number | null>(null);
  newCityLng = signal<number | null>(null);
  geocodingCity = signal(false);
  savingCity = signal(false);

  // Adding new plan item
  addingItemType = signal<PlanItemType | null>(null);
  planItemForm!: FormGroup;

  // Editing existing plan item
  editingItemId = signal<number | null>(null);

  private nextLocalId = -1;

  /** Sort plan items by startDate (earliest first) */
  private sortPlanItemsByDate(items: AnyPlanItem[]): AnyPlanItem[] {
    return [...items].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }

  /** Countries derived from plan items */
  derivedCountries = computed(() => {
    const items = this.planItems();
    const allCountries = this.countries();
    const countryIds = new Set<number>();

    for (const item of items) {
      switch (item.type) {
        case 'flight':
          countryIds.add((item as PlanFlight).fromCountryId);
          countryIds.add((item as PlanFlight).toCountryId);
          break;
        case 'attraction':
          countryIds.add((item as PlanAttraction).countryId);
          break;
        case 'accommodation':
          countryIds.add((item as PlanAccommodation).countryId);
          break;
        case 'ferry':
          countryIds.add((item as PlanFerry).countryIdFrom);
          countryIds.add((item as PlanFerry).countryIdTo);
          break;
        case 'train':
          countryIds.add((item as TrainPlan).countryIdFrom);
          countryIds.add((item as TrainPlan).countryIdTo);
          break;
        case 'car_rental':
          break;
      }
    }

    return allCountries
      .filter((c) => countryIds.has(c.id))
      .map((c) => c.name);
  });

  /** Date range derived from plan items */
  derivedStartDate = computed(() => {
    const items = this.planItems();
    if (!items.length) return null;
    const dates = items.flatMap((i) => [i.startDate, i.endDate]).filter(Boolean).sort();
    return dates[0] || null;
  });

  derivedEndDate = computed(() => {
    const items = this.planItems();
    if (!items.length) return null;
    const dates = items.flatMap((i) => [i.startDate, i.endDate]).filter(Boolean).sort();
    return dates[dates.length - 1] || null;
  });

  planMenuItems: { type: PlanItemType; label: string; icon: string }[] = [
    { type: 'flight', label: 'Flight', icon: 'flight' },
    { type: 'attraction', label: 'Attraction', icon: 'attractions' },
    { type: 'accommodation', label: 'Accommodation', icon: 'hotel' },
    { type: 'car_rental', label: 'Car Rental', icon: 'directions_car' },
    { type: 'ferry', label: 'Ferry', icon: 'directions_boat' },
    { type: 'train', label: 'Train', icon: 'train' },
  ];

  ngOnInit(): void {
    this.initForm();
    this.loadCountries();
    this.loadCities();

    const id = this.route.snapshot.paramMap.get('id');
    this.tripId = +(id ?? 0);
    this.loadTrip(this.tripId);
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      notes: [''],
    });
  }

  private loadCountries(): void {
    this.countriesService.getAllCountries('name').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.countries.set(response.countries);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to load countries',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
      },
    });
  }

  private loadCities(): void {
    this.citiesService.getAllCities('name').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.cities.set(response.cities);
      },
      error: () => {
        // Cities are optional for autocomplete, fail silently
      },
    });
  }

  // ── Inline add new country ──

  startAddCountry(fieldKey: string): void {
    this.addingNewCountryFor.set(fieldKey);
    this.newCountryName.set('');
    this.newCountryLat.set(null);
    this.newCountryLng.set(null);
  }

  cancelAddCountry(): void {
    this.addingNewCountryFor.set(null);
    this.newCountryName.set('');
    this.newCountryLat.set(null);
    this.newCountryLng.set(null);
  }

  confirmAddCountry(fieldKey: string): void {
    const name = this.newCountryName().trim();
    if (!name) return;

    this.savingCountry.set(true);
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const geoMapId = `new-${slug}-${Date.now()}`;
    const lat = this.newCountryLat() ?? 0;
    const lng = this.newCountryLng() ?? 0;
    this.countriesService.createCountry({ name, abbreviation: '', lat, lng, slug, geo_map_id: geoMapId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const newCountry: Country = { id: response.id!, name, abbreviation: '', lat, lng };
        this.countries.update((c) => [...c, newCountry].sort((a, b) => a.name.localeCompare(b.name)));
        // Set the value on the plan item form
        if (this.planItemForm) {
          this.planItemForm.get(fieldKey)?.setValue(response.id);
        }
        this.snackBar.open(`Country "${name}" added`, 'Close', { duration: 3000 });
        this.addingNewCountryFor.set(null);
        this.newCountryName.set('');
        this.newCountryLat.set(null);
        this.newCountryLng.set(null);
        this.savingCountry.set(false);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to create country', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
        this.savingCountry.set(false);
      },
    });
  }

  // ── Inline add new city ──

  startAddCity(fieldKey: string): void {
    this.addingNewCityFor.set(fieldKey);
    this.newCityName.set('');
    this.newCityCountryId.set(null);
    this.newCityLat.set(null);
    this.newCityLng.set(null);
  }

  cancelAddCity(): void {
    this.addingNewCityFor.set(null);
    this.newCityName.set('');
    this.newCityCountryId.set(null);
    this.newCityLat.set(null);
    this.newCityLng.set(null);
  }

  confirmAddCity(fieldKey: string): void {
    const name = this.newCityName().trim();
    const countryId = this.newCityCountryId();
    if (!name || !countryId) return;

    this.savingCity.set(true);
    const lat = this.newCityLat() ?? 0;
    const lng = this.newCityLng() ?? 0;
    this.citiesService.createCity({ name, lat, lng, country_id: countryId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const countryName = this.countries().find((c) => c.id === countryId)?.name || '';
        const newCity: City = { id: response.id!, name, lat, lng, country_id: countryId, country_name: countryName };
        this.cities.update((c) => [...c, newCity].sort((a, b) => a.name.localeCompare(b.name)));
        // Set the city name on the form field
        if (this.planItemForm) {
          this.planItemForm.get(fieldKey)?.setValue(name);
        }
        this.snackBar.open(`City "${name}" added`, 'Close', { duration: 3000 });
        this.addingNewCityFor.set(null);
        this.newCityName.set('');
        this.newCityCountryId.set(null);
        this.newCityLat.set(null);
        this.newCityLng.set(null);
        this.savingCity.set(false);
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to create city', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
        this.savingCity.set(false);
      },
    });
  }

  lookupCountryCoords(): void {
    const name = this.newCountryName().trim();
    if (!name) {
      this.snackBar.open('Please enter a country name first', 'Close', { duration: 3000 });
      return;
    }
    this.geocodingCountry.set(true);
    this.geocodeService.forwardGeocode({ country: name }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.newCountryLat.set(result.lat);
        this.newCountryLng.set(result.lng);
        this.geocodingCountry.set(false);
      },
      error: () => {
        this.snackBar.open('Could not find coordinates for this country', 'Close', { duration: 4000, panelClass: 'error-snackbar' });
        this.geocodingCountry.set(false);
      },
    });
  }

  lookupCityCoords(): void {
    const name = this.newCityName().trim();
    if (!name) {
      this.snackBar.open('Please enter a city name first', 'Close', { duration: 3000 });
      return;
    }
    const countryId = this.newCityCountryId();
    const country = countryId ? this.countries().find((c) => c.id === countryId) : null;

    this.geocodingCity.set(true);
    const request = country
      ? { city: name, country: country.name }
      : { place: name };
    this.geocodeService.forwardGeocode(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.newCityLat.set(result.lat);
        this.newCityLng.set(result.lng);
        this.geocodingCity.set(false);
      },
      error: () => {
        this.snackBar.open('Could not find coordinates for this city', 'Close', { duration: 4000, panelClass: 'error-snackbar' });
        this.geocodingCity.set(false);
      },
    });
  }

  filterCities(value: string): City[] {
    if (!value) return this.cities();
    const filter = value.toLowerCase();
    return this.cities().filter((c) => c.name.toLowerCase().includes(filter));
  }

  // ── Country combobox ──

  /** Tracks the typed text for each country autocomplete field */
  countryInputValues = signal<Record<string, string>>({});

  filterCountries(inputText: string): Country[] {
    if (!inputText) return this.countries();
    const filter = inputText.toLowerCase();
    return this.countries().filter((c) => c.name.toLowerCase().includes(filter));
  }

  displayCountryFn = (countryId: number): string => {
    if (!countryId) return '';
    return this.countries().find((c) => c.id === countryId)?.name || '';
  };

  onCountryInput(value: string, fieldKey: string): void {
    this.countryInputValues.update((v) => ({ ...v, [fieldKey]: value }));
  }

  onCountrySelected(countryId: number, fieldKey: string): void {
    if (this.planItemForm) {
      this.planItemForm.get(fieldKey)?.setValue(countryId);
    }
    // Clear the input filter text so next open shows all
    this.countryInputValues.update((v) => ({ ...v, [fieldKey]: '' }));
  }

  /** When a city is selected from autocomplete, auto-fill the paired country field */
  onCitySelected(cityName: string, countryFieldKey: string): void {
    const city = this.cities().find((c) => c.name === cityName);
    if (city?.country_id && this.planItemForm) {
      this.planItemForm.get(countryFieldKey)?.setValue(city.country_id);
    }
  }

  private loadTrip(id: number): void {
    this.loading.set(true);
    this.tripsService.getTrip(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (trip: Trip) => {
        this.form.patchValue({
          name: trip.name,
          notes: trip.notes || '',
        });
        // Defensive: plan may come back as a JSON string instead of an array
        let plan = trip.plan;
        if (typeof plan === 'string') {
          try {
            plan = JSON.parse(plan);
          } catch {
            plan = [];
          }
        }
        const parsedPlan = Array.isArray(plan) ? plan : [];
        console.log('[TripEdit] Loaded trip', trip.id, '– plan items:', parsedPlan.length, parsedPlan);
        this.planItems.set(this.sortPlanItemsByDate(parsedPlan));
        this.loading.set(false);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.error || 'Failed to load trip',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.loading.set(false);
        this.router.navigate(['/trips']);
      },
    });
  }

  getCountryName(id: number): string {
    return this.countries().find((c) => c.id === id)?.name || '';
  }

  // ── Plan item management ──

  startAddPlanItem(type: PlanItemType): void {
    this.editingItemId.set(null);
    this.addingItemType.set(type);
    this.planItemForm = this.buildPlanItemForm(type);

    // Default end date to start date when user picks a start date
    this.planItemForm.get('startDate')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const endDate = this.planItemForm.get('endDate')?.value;
      if (value && !endDate) {
        this.planItemForm.get('endDate')?.setValue(value);
      }
    });
  }

  cancelAddPlanItem(): void {
    this.addingItemType.set(null);
  }

  confirmAddPlanItem(): void {
    if (this.planItemForm.invalid) {
      this.planItemForm.markAllAsTouched();
      return;
    }

    const raw = this.planItemForm.value;
    const type = this.addingItemType()!;

    const item = this.buildPlanItemFromForm(type, raw, this.nextLocalId--);
    this.planItems.update((items) => this.sortPlanItemsByDate([...items, item]));
    this.planDirty.set(true);
    this.addingItemType.set(null);
  }

  startEditPlanItem(item: AnyPlanItem): void {
    this.addingItemType.set(null);
    this.editingItemId.set(item.id);
    this.planItemForm = this.buildPlanItemForm(item.type, item);
  }

  cancelEditPlanItem(): void {
    this.editingItemId.set(null);
  }

  confirmEditPlanItem(itemId: number): void {
    if (this.planItemForm.invalid) {
      this.planItemForm.markAllAsTouched();
      return;
    }

    const raw = this.planItemForm.value;
    const existing = this.planItems().find((i) => i.id === itemId);
    if (!existing) return;

    const updated = this.buildPlanItemFromForm(existing.type, raw, itemId);
    this.planItems.update((items) =>
      this.sortPlanItemsByDate(items.map((i) => (i.id === itemId ? updated : i)))
    );
    this.planDirty.set(true);
    this.editingItemId.set(null);
  }

  removePlanItem(id: number): void {
    this.planItems.update((items) => items.filter((i) => i.id !== id));
    this.planDirty.set(true);
  }

  getPlanItemLabel(type: PlanItemType): string {
    return this.planMenuItems.find((m) => m.type === type)?.label || type;
  }

  getPlanItemIcon(type: PlanItemType): string {
    return this.planMenuItems.find((m) => m.type === type)?.icon || 'event';
  }

  getPlanItemSummary(item: AnyPlanItem): string {
    switch (item.type) {
      case 'flight':
        return `${item.from} → ${item.to}`;
      case 'attraction':
        return item.attractionName;
      case 'accommodation':
        return item.city ? `${item.name} — ${item.city}` : item.name;
      case 'car_rental':
        return `${item.company} — ${item.pickupLocation} → ${item.dropoffLocation}`;
      case 'ferry':
        return `${item.from} → ${item.to}`;
      case 'train':
        return `${item.from} → ${item.to}`;
    }
  }

  private formatDateValue(d: Date | string | null): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatDisplayDate(dateStr: string, format: string): string {
    if (!dateStr) return '—';
    try {
      // Ensure date string has time component for consistent parsing
      const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00';
      return this.datePipe.transform(normalized, format) || dateStr;
    } catch {
      return dateStr;
    }
  }

  private buildPlanItemForm(type: PlanItemType, existing?: AnyPlanItem): FormGroup {
    const startDate = existing ? new Date(existing.startDate) : null;
    const endDate = existing ? new Date(existing.endDate) : null;

    const base = {
      startDate: [startDate, [Validators.required]],
      endDate: [endDate, [Validators.required]],
    };

    switch (type) {
      case 'flight': {
        const f = existing as PlanFlight | undefined;
        return this.fb.group({
          ...base,
          from: [f?.from || '', Validators.required],
          fromCountryId: [f?.fromCountryId || null, Validators.required],
          to: [f?.to || '', Validators.required],
          toCountryId: [f?.toCountryId || null, Validators.required],
        });
      }
      case 'attraction': {
        const a = existing as PlanAttraction | undefined;
        return this.fb.group({
          ...base,
          attractionId: [a?.attractionId || null],
          attractionName: [a?.attractionName || '', Validators.required],
          typeOfAttraction: [a?.typeOfAttraction || 'Other', Validators.required],
          countryId: [a?.countryId || null, Validators.required],
        });
      }
      case 'accommodation': {
        const ac = existing as PlanAccommodation | undefined;
        return this.fb.group({
          ...base,
          name: [ac?.name || '', Validators.required],
          city: [ac?.city || '', Validators.required],
          countryId: [ac?.countryId || null, Validators.required],
        });
      }
      case 'car_rental': {
        const cr = existing as PlanCarRental | undefined;
        return this.fb.group({
          ...base,
          company: [cr?.company || '', Validators.required],
          pickupLocation: [cr?.pickupLocation || '', Validators.required],
          dropoffLocation: [cr?.dropoffLocation || '', Validators.required],
        });
      }
      case 'ferry': {
        const fe = existing as PlanFerry | undefined;
        return this.fb.group({
          ...base,
          from: [fe?.from || '', Validators.required],
          countryIdFrom: [fe?.countryIdFrom || null, Validators.required],
          to: [fe?.to || '', Validators.required],
          countryIdTo: [fe?.countryIdTo || null, Validators.required],
        });
      }
      case 'train': {
        const tr = existing as TrainPlan | undefined;
        return this.fb.group({
          ...base,
          from: [tr?.from || '', Validators.required],
          countryIdFrom: [tr?.countryIdFrom || null, Validators.required],
          to: [tr?.to || '', Validators.required],
          countryIdTo: [tr?.countryIdTo || null, Validators.required],
        });
      }
    }
  }

  private buildPlanItemFromForm(type: PlanItemType, raw: Record<string, unknown>, id: number): AnyPlanItem {
    const startDate = this.formatDateValue(raw['startDate'] as Date | null);
    const endDate = this.formatDateValue(raw['endDate'] as Date | null);

    switch (type) {
      case 'flight':
        return { id, type, startDate, endDate, from: raw['from'] as string, fromCountryId: raw['fromCountryId'] as number, to: raw['to'] as string, toCountryId: raw['toCountryId'] as number };
      case 'attraction':
        return { id, type, startDate, endDate, attractionId: raw['attractionId'] as number, attractionName: raw['attractionName'] as string, typeOfAttraction: raw['typeOfAttraction'] as 'UNESCO' | 'National Park' | 'Other', countryId: raw['countryId'] as number };
      case 'accommodation':
        return { id, type, startDate, endDate, name: raw['name'] as string, city: raw['city'] as string, countryId: raw['countryId'] as number };
      case 'car_rental':
        return { id, type, startDate, endDate, company: raw['company'] as string, pickupLocation: raw['pickupLocation'] as string, dropoffLocation: raw['dropoffLocation'] as string };
      case 'ferry':
        return { id, type, startDate, endDate, from: raw['from'] as string, countryIdFrom: raw['countryIdFrom'] as number, to: raw['to'] as string, countryIdTo: raw['countryIdTo'] as number };
      case 'train':
        return { id, type, startDate, endDate, from: raw['from'] as string, countryIdFrom: raw['countryIdFrom'] as number, to: raw['to'] as string, countryIdTo: raw['countryIdTo'] as number };
    }
  }

  // ── Save ──

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formValue = this.form.value;

    const payload = {
      name: formValue.name,
      notes: formValue.notes || undefined,
      plan: this.planItems(),
    };

    const request$ = this.tripsService.updateTrip(this.tripId, payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved = true;
        this.snackBar.open('Trip updated successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/trips']);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.error || 'Failed to update trip',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.saving.set(false);
      },
    });
  }
}

