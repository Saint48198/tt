import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_FORMATS } from '@angular/material/core';
import { MapComponent, MapMarker } from '@shared/components';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery.component';
import { CitiesService } from '../../services/cities.service';
import { CountriesService } from '../../services/countries.service';
import { StatesService } from '../../services/states.service';
import { GeocodeService } from '../../services/geocode.service';
import { InfoService, InfoResult } from '../../services/info.service';
import { City, Country, State } from '../../interfaces';

const MONTH_YEAR_FORMATS = {
  parse: { dateInput: 'MM/YYYY' },
  display: {
    dateInput: { year: 'numeric', month: '2-digit' } as Intl.DateTimeFormatOptions,
    monthYearLabel: { year: 'numeric', month: 'short' } as Intl.DateTimeFormatOptions,
    dateA11yLabel: { year: 'numeric', month: 'long' } as Intl.DateTimeFormatOptions,
    monthYearA11yLabel: { year: 'numeric', month: 'long' } as Intl.DateTimeFormatOptions,
  },
};

@Component({
  selector: 'app-city-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MapComponent,
    PhotoGalleryComponent,
  ],
  templateUrl: './city-edit.component.html',
  styleUrl: './city-edit.component.scss',
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS }],
})
export class CityEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly citiesService = inject(CitiesService);
  private readonly countriesService = inject(CountriesService);
  private readonly statesService = inject(StatesService);
  private readonly geocodeService = inject(GeocodeService);
  private readonly infoService = inject(InfoService);
  private readonly snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);
  saving = signal(false);
  geocoding = signal(false);
  loadingWiki = signal(false);
  wikiInfo = signal<InfoResult | null>(null);
  cityId: number | null = null;
  countries = signal<Country[]>([]);
  states = signal<State[]>([]);
  mapMarkers = signal<MapMarker[]>([]);
  mapCenter = signal<[number, number]>([39.8283, -98.5795]);
  hasCoordinates = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.loadCountries();
    this.loadStates();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.cityId = +id;
      this.loadCity(this.cityId);
    }

    // React to lat/lng form changes to update the map
    this.form.get('lat')?.valueChanges.subscribe(() => this.updateMapFromForm());
    this.form.get('lng')?.valueChanges.subscribe(() => this.updateMapFromForm());
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      lat: [null, [Validators.required]],
      lng: [null, [Validators.required]],
      country_id: [null, [Validators.required]],
      state_id: [null],
      last_visited: [null as Date | null],
      wiki_term: ['', [Validators.maxLength(255)]],
    });
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length >= 2) {
      return new Date(+parts[0], +parts[1] - 1, 1);
    }
    return null;
  }

  private formatDate(value: Date | null): string | undefined {
    if (!value || isNaN(value.getTime())) return undefined;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private loadCountries(): void {
    this.countriesService.getAllCountries('name').subscribe({
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

  private loadStates(): void {
    this.statesService.getAllStates('name').subscribe({
      next: (response) => {
        this.states.set(response.states);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to load states',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
      },
    });
  }

  get filteredStates(): State[] {
    const countryId = this.form.get('country_id')?.value;
    if (!countryId) return this.states();
    return this.states().filter((s) => s.country_id === countryId);
  }

  private loadCity(id: number): void {
    this.loading.set(true);
    this.citiesService.getCity(id).subscribe({
      next: (city: City) => {
        this.form.patchValue({
          name: city.name,
          lat: city.lat,
          lng: city.lng,
          country_id: city.country_id,
          state_id: city.state_id ?? null,
          last_visited: this.parseDate(city.last_visited),
          wiki_term: city.wiki_term || '',
        });
        this.loading.set(false);
        this.updateMapFromForm();
        if (city.wiki_term) {
          this.lookupWikiInfo();
        }
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to load city',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.loading.set(false);
        this.router.navigate(['/cities']);
      },
    });
  }

  private updateMapFromForm(): void {
    const lat = this.form.get('lat')?.value;
    const lng = this.form.get('lng')?.value;

    if (lat != null && lng != null && lat !== '' && lng !== '') {
      const latNum = +lat;
      const lngNum = +lng;
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        this.hasCoordinates.set(true);
        this.mapCenter.set([latNum, lngNum]);
        this.mapMarkers.set([
          {
            lat: latNum,
            lng: lngNum,
            title: this.form.get('name')?.value || 'City',
            popup: `<strong>${this.form.get('name')?.value || 'City'}</strong><br/>Lat: ${latNum}, Lng: ${lngNum}`,
          },
        ]);
        return;
      }
    }
    this.hasCoordinates.set(false);
    this.mapMarkers.set([]);
  }

  lookupCoordinates(): void {
    const name = this.form.get('name')?.value?.trim();
    if (!name) {
      this.snackBar.open('Please enter a city name first', 'Close', { duration: 3000 });
      return;
    }

    const countryId = this.form.get('country_id')?.value;
    const country = this.countries().find((c) => c.id === countryId);
    const stateId = this.form.get('state_id')?.value;
    const state = this.states().find((s) => s.id === stateId);

    this.geocoding.set(true);

    const request = country
      ? { city: name, country: country.name, state: state?.name }
      : { place: name };

    this.geocodeService.forwardGeocode(request).subscribe({
      next: (result) => {
        this.form.patchValue({ lat: result.lat, lng: result.lng });
        this.snackBar.open(
          `Coordinates found: ${result.lat}, ${result.lng}`,
          'Close',
          { duration: 3000 }
        );
        this.geocoding.set(false);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to look up coordinates',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.geocoding.set(false);
      },
    });
  }

  onMonthSelected(date: Date, datepicker: MatDatepicker<Date>): void {
    this.form.get('last_visited')?.setValue(new Date(date.getFullYear(), date.getMonth(), 1));
    datepicker.close();
  }

  lookupWikiInfo(): void {
    const wikiTerm = this.form.get('wiki_term')?.value?.trim();
    if (!wikiTerm) {
      this.snackBar.open('Please enter a wiki term first', 'Close', { duration: 3000 });
      return;
    }

    this.loadingWiki.set(true);
    this.wikiInfo.set(null);
    this.infoService.getInfo(wikiTerm).subscribe({
      next: (result) => {
        this.wikiInfo.set(result);
        this.loadingWiki.set(false);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.error || 'Failed to look up wiki info',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.loadingWiki.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formValue = this.form.value;

    const payload = {
      name: formValue.name,
      lat: +formValue.lat,
      lng: +formValue.lng,
      country_id: formValue.country_id,
      state_id: formValue.state_id || undefined,
      last_visited: this.formatDate(formValue.last_visited),
      wiki_term: formValue.wiki_term || undefined,
    };

    const request$ = this.isEditMode() && this.cityId
      ? this.citiesService.updateCity(this.cityId, payload)
      : this.citiesService.createCity(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          `City ${this.isEditMode() ? 'updated' : 'created'} successfully`,
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/cities']);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || `Failed to ${this.isEditMode() ? 'update' : 'create'} city`,
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.saving.set(false);
      },
    });
  }
}


