import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_FORMATS } from '@angular/material/core';
import { forkJoin, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { MapComponent, MapMarker } from '@shared/components';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery.component';
import { AttractionsService } from '../../services/attractions.service';
import { CountriesService } from '../../services/countries.service';
import { StatesService } from '../../services/states.service';
import { GeocodeService } from '../../services/geocode.service';
import { InfoService, InfoResult } from '../../services/info.service';
import { Country, State } from '../../interfaces';

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
  selector: 'app-attraction-edit',
  imports: [
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MapComponent,
    PhotoGalleryComponent,
  ],
  templateUrl: './attraction-edit.component.html',
  styleUrl: './attraction-edit.component.scss',
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS }],
})
export class AttractionEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly attractionsService = inject(AttractionsService);
  private readonly countriesService = inject(CountriesService);
  private readonly statesService = inject(StatesService);
  private readonly geocodeService = inject(GeocodeService);
  private readonly infoService = inject(InfoService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  private readonly COUNTRIES_WITH_STATES = ['United States', 'United States of America', 'Canada'];

  form!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);
  saving = signal(false);
  geocoding = signal(false);
  loadingWiki = signal(false);
  wikiInfo = signal<InfoResult | null>(null);
  attractionId: number | null = null;
  countries = signal<Country[]>([]);
  states = signal<State[]>([]);
  loadingStates = signal(false);
  selectedCountryName = signal<string>('');
  showStates = computed(() => this.COUNTRIES_WITH_STATES.includes(this.selectedCountryName()));
  mapMarkers = signal<MapMarker[]>([]);
  mapCenter = signal<[number, number]>([39.8283, -98.5795]);
  hasCoordinates = signal(false);

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.attractionId = +id;
    }

    this.loadInitialData();
    this.listenForCountryChanges();

    this.form
      .get('lat')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateMapFromForm());
    this.form
      .get('lng')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateMapFromForm());
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      country_id: [null, [Validators.required]],
      state_id: [null as number | null],
      lat: [null, [Validators.required]],
      lng: [null, [Validators.required]],
      is_unesco: [false],
      is_national_park: [false],
      last_visited: [null as Date | null],
      wiki_term: ['', [Validators.maxLength(255)]],
    });
  }

  /**
   * Load countries (always) and attraction (in edit mode) in parallel via forkJoin.
   * Once both resolve, patch the form and chain into loading states if needed.
   */
  private loadInitialData(): void {
    this.loading.set(true);

    const countries$ = this.countriesService.getAllCountries('name');
    const attraction$ = this.attractionId
      ? this.attractionsService.getAttraction(this.attractionId)
      : of(null);

    forkJoin({ countries: countries$, attraction: attraction$ })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        // After both load, populate countries and patch form
        tap(({ countries, attraction }) => {
          this.countries.set(countries.countries);

          if (attraction) {
            this.form.patchValue({
              name: attraction.name,
              country_id: attraction.country_id,
              lat: attraction.lat,
              lng: attraction.lng,
              is_unesco: attraction.is_unesco ?? false,
              is_national_park: attraction.is_national_park ?? false,
              last_visited: this.parseDate(attraction.last_visited),
              wiki_term: attraction.wiki_term || '',
            });
            this.updateMapFromForm();
          }
        }),
        // Determine if we need to load states for the current country
        switchMap(({ countries, attraction }) => {
          const countryId = attraction?.country_id;
          const country = countryId
            ? countries.countries.find((c) => c.id === countryId)
            : undefined;

          if (country && this.COUNTRIES_WITH_STATES.includes(country.name)) {
            this.selectedCountryName.set(country.name);
            this.loadingStates.set(true);
            return this.statesService.getAllStates('name').pipe(
              tap((res) => {
                this.states.set(
                  res.states.filter((s) => Number(s.country_id) === Number(countryId))
                );
                this.loadingStates.set(false);
                // Patch state_id after states are loaded so the select can match
                if (attraction?.state_id) {
                  this.form.patchValue({ state_id: attraction.state_id });
                }
              }),
              catchError(() => {
                this.states.set([]);
                this.loadingStates.set(false);
                return of(undefined);
              })
            );
          }
          return of(undefined);
        })
      )
      .subscribe({
        next: () => {
          this.loading.set(false);
          // Trigger wiki lookup after everything is settled
          if (this.form.get('wiki_term')?.value) {
            this.lookupWikiInfo();
          }
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to load data', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
          if (this.isEditMode()) {
            this.router.navigate(['/attractions']);
          }
        },
      });
  }

  /**
   * When the user changes country after initial load, reload states if US/Canada
   * or clear them otherwise. Uses switchMap to cancel any in-flight states request.
   */
  private listenForCountryChanges(): void {
    this.form
      .get('country_id')
      ?.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((countryId) => {
          const country = this.countries().find((c) => c.id === countryId);
          this.selectedCountryName.set(country?.name || '');
        }),
        switchMap((countryId) => {
          if (this.showStates()) {
            this.loadingStates.set(true);
            return this.statesService.getAllStates('name').pipe(
              tap((res) => {
                this.states.set(
                  res.states.filter((s) => Number(s.country_id) === Number(countryId))
                );
                this.loadingStates.set(false);
              }),
              catchError(() => {
                this.states.set([]);
                this.loadingStates.set(false);
                return of(undefined);
              })
            );
          }
          this.states.set([]);
          this.form.get('state_id')?.setValue(null);
          return of(undefined);
        })
      )
      .subscribe();
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
    return `${year}-${month}-01`;
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
            title: this.form.get('name')?.value || 'Attraction',
            popup: `<strong>${this.form.get('name')?.value || 'Attraction'}</strong><br/>Lat: ${latNum}, Lng: ${lngNum}`,
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
      this.snackBar.open('Please enter an attraction name first', 'Close', { duration: 3000 });
      return;
    }

    const countryId = this.form.get('country_id')?.value;
    const country = this.countries().find((c) => c.id === countryId);

    this.geocoding.set(true);

    const request = country ? { place: `${name}, ${country.name}` } : { place: name };

    this.geocodeService
      .forwardGeocode(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.form.patchValue({ lat: result.lat, lng: result.lng });
          this.snackBar.open(`Coordinates found: ${result.lat}, ${result.lng}`, 'Close', {
            duration: 3000,
          });
          this.geocoding.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to look up coordinates', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
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
    this.infoService
      .getInfo(wikiTerm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.wikiInfo.set(result);
          this.loadingWiki.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to look up wiki info', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
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
      country_id: formValue.country_id,
      state_id: formValue.state_id || null,
      lat: +formValue.lat,
      lng: +formValue.lng,
      is_unesco: formValue.is_unesco || false,
      is_national_park: formValue.is_national_park || false,
      last_visited: this.formatDate(formValue.last_visited),
      wiki_term: formValue.wiki_term || undefined,
    };

    const request$ =
      this.isEditMode() && this.attractionId
        ? this.attractionsService.updateAttraction(this.attractionId, payload)
        : this.attractionsService.createAttraction(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(
          `Attraction ${this.isEditMode() ? 'updated' : 'created'} successfully`,
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/attractions']);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || `Failed to ${this.isEditMode() ? 'update' : 'create'} attraction`,
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.saving.set(false);
      },
    });
  }
}
