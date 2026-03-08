import { Component, DestroyRef, OnInit, inject, signal, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MapComponent, MapMarker } from '@shared/components';
import { HasUnsavedChanges } from '@shared/services';
import { CountriesService } from '../../services/countries.service';
import { GeocodeService } from '../../services/geocode.service';
import { Country } from '../../interfaces';

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
  selector: 'app-country-edit',
  imports: [
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
    MapComponent,
  ],
  templateUrl: './country-edit.component.html',
  styleUrl: './country-edit.component.scss',
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS }],
})
export class CountryEditComponent implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly countriesService = inject(CountriesService);
  private readonly geocodeService = inject(GeocodeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);
  saving = signal(false);
  geocoding = signal(false);
  countryId: number | null = null;
  mapMarkers = signal<MapMarker[]>([]);
  mapCenter = signal<[number, number]>([39.8283, -98.5795]);
  hasCoordinates = signal(false);
  private saved = false;

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    if (this.saved) return false;
    return this.form?.dirty ?? false;
  }

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.countryId = +id;
      this.loadCountry(this.countryId);
    }

    // React to lat/lng form changes to update the map
    this.form.get('lat')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateMapFromForm());
    this.form.get('lng')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateMapFromForm());
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      abbreviation: ['', [Validators.required, Validators.maxLength(10)]],
      lat: [null, [Validators.required]],
      lng: [null, [Validators.required]],
      slug: ['', [Validators.required, Validators.maxLength(255)]],
      last_visited: [null as Date | null],
      geo_map_id: ['', [Validators.required, Validators.maxLength(255)]],
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
    if (!value || !(value instanceof Date) || isNaN(value.getTime())) return undefined;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  private loadCountry(id: number): void {
    this.loading.set(true);
    this.countriesService.getCountry(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (country: Country) => {
        this.form.patchValue({
          name: country.name,
          abbreviation: country.abbreviation || '',
          lat: country.lat ?? null,
          lng: country.lng ?? null,
          slug: country.slug || '',
          last_visited: this.parseDate(country.last_visited),
          geo_map_id: country.geo_map_id || '',
        });
        this.loading.set(false);
        this.updateMapFromForm();
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to load country',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.loading.set(false);
        this.router.navigate(['/countries']);
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
            title: this.form.get('name')?.value || 'Country',
            popup: `<strong>${this.form.get('name')?.value || 'Country'}</strong><br/>Lat: ${latNum}, Lng: ${lngNum}`,
          },
        ]);
        return;
      }
    }
    this.hasCoordinates.set(false);
    this.mapMarkers.set([]);
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
      abbreviation: formValue.abbreviation ?? '',
      lat: formValue.lat != null && formValue.lat !== '' ? +formValue.lat : undefined,
      lng: formValue.lng != null && formValue.lng !== '' ? +formValue.lng : undefined,
      slug: formValue.slug || undefined,
      last_visited: this.formatDate(formValue.last_visited),
      geo_map_id: formValue.geo_map_id || undefined,
    };

    const request$ = this.isEditMode() && this.countryId
      ? this.countriesService.updateCountry(this.countryId, payload)
      : this.countriesService.createCountry(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved = true;
        this.snackBar.open(
          `Country ${this.isEditMode() ? 'updated' : 'created'} successfully`,
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/countries']);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.error || `Failed to ${this.isEditMode() ? 'update' : 'create'} country`,
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.saving.set(false);
      },
    });
  }

  lookupCoordinates(): void {
    const name = this.form.get('name')?.value?.trim();
    if (!name) {
      this.snackBar.open('Please enter a country name first', 'Close', { duration: 3000 });
      return;
    }

    this.geocoding.set(true);
    this.geocodeService.forwardGeocode({ country: name }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
}




