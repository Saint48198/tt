import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CountriesService } from '../../services/countries.service';
import { Country } from '../../interfaces';

@Component({
  selector: 'app-country-edit',
  standalone: true,
  imports: [
    CommonModule,
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
  ],
  templateUrl: './country-edit.component.html',
  styleUrl: './country-edit.component.scss',
})
export class CountryEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly countriesService = inject(CountriesService);
  private readonly snackBar = inject(MatSnackBar);

  form!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);
  saving = signal(false);
  countryId: number | null = null;

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.countryId = +id;
      this.loadCountry(this.countryId);
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      abbreviation: ['', [Validators.maxLength(10)]],
      lat: [null],
      lng: [null],
      slug: ['', [Validators.maxLength(255)]],
      last_visited: [''],
      geo_map_id: ['', [Validators.maxLength(255)]],
    });
  }

  private loadCountry(id: number): void {
    this.loading.set(true);
    this.countriesService.getCountry(id).subscribe({
      next: (country: Country) => {
        this.form.patchValue({
          name: country.name,
          abbreviation: country.abbreviation || '',
          lat: country.lat ?? null,
          lng: country.lng ?? null,
          slug: country.slug || '',
          last_visited: country.last_visited || '',
          geo_map_id: country.geo_map_id || '',
        });
        this.loading.set(false);
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formValue = this.form.value;

    const payload = {
      name: formValue.name,
      abbreviation: formValue.abbreviation || undefined,
      lat: formValue.lat != null && formValue.lat !== '' ? +formValue.lat : undefined,
      lng: formValue.lng != null && formValue.lng !== '' ? +formValue.lng : undefined,
      slug: formValue.slug || undefined,
      last_visited: formValue.last_visited || undefined,
      geo_map_id: formValue.geo_map_id || undefined,
    };

    const request$ = this.isEditMode() && this.countryId
      ? this.countriesService.updateCountry(this.countryId, payload)
      : this.countriesService.createCountry(payload);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          `Country ${this.isEditMode() ? 'updated' : 'created'} successfully`,
          'Close',
          { duration: 3000 }
        );
        this.router.navigate(['/countries']);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || `Failed to ${this.isEditMode() ? 'update' : 'create'} country`,
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
        this.saving.set(false);
      },
    });
  }
}




