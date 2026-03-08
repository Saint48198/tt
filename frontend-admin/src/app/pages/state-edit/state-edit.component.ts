import { Component, DestroyRef, OnInit, inject, signal, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { HasUnsavedChanges } from '@shared/services';
import { StatesService } from '../../services/states.service';
import { CountriesService } from '../../services/countries.service';
import { State, Country } from '../../interfaces';

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
  selector: 'app-state-edit',
  imports: [
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
  ],
  templateUrl: './state-edit.component.html',
  styleUrl: './state-edit.component.scss',
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MONTH_YEAR_FORMATS }],
})
export class StateEditComponent implements OnInit, HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly statesService = inject(StatesService);
  private readonly countriesService = inject(CountriesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);
  saving = signal(false);
  stateId: number | null = null;
  countries = signal<Country[]>([]);
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
    this.loadCountries();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.stateId = +id;
      this.loadState(this.stateId);
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      abbr: ['', [Validators.maxLength(10)]],
      country_id: [null, [Validators.required]],
      last_visited: [null as Date | null],
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

  private loadCountries(): void {
    this.countriesService
      .getAllCountries('name')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.countries.set(response.countries);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to load countries', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }

  private loadState(id: number): void {
    this.loading.set(true);
    this.statesService
      .getState(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state: State) => {
          this.form.patchValue({
            name: state.name,
            abbr: state.abbr || '',
            country_id: state.country_id,
            last_visited: this.parseDate(state.last_visited),
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to load state', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
          this.router.navigate(['/states']);
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
      abbr: formValue.abbr || undefined,
      country_id: formValue.country_id,
      last_visited: this.formatDate(formValue.last_visited),
    };

    const request$ =
      this.isEditMode() && this.stateId
        ? this.statesService.updateState(this.stateId, payload)
        : this.statesService.createState(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved = true;
        this.snackBar.open(
          `State ${this.isEditMode() ? 'updated' : 'created'} successfully`,
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/states']);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || `Failed to ${this.isEditMode() ? 'update' : 'create'} state`,
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.saving.set(false);
      },
    });
  }

  onMonthSelected(date: Date, datepicker: MatDatepicker<Date>): void {
    this.form.get('last_visited')?.setValue(new Date(date.getFullYear(), date.getMonth(), 1));
    datepicker.close();
  }
}
