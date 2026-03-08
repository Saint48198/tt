import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CountriesService } from '../../../services/countries.service';
import { Country } from '../../../interfaces';

export interface ChangeCountryDialogResult {
  changed: boolean;
  countryId?: number;
  countryName?: string;
}

@Component({
  selector: 'app-change-country-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dialog-title-icon">public</mat-icon>
      Change Country
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Search countries</mat-label>
        <input
          matInput
          [(ngModel)]="searchQuery"
          placeholder="Type to filter..."
          autocomplete="off"
        />
        <mat-icon matPrefix>search</mat-icon>
        @if (searchQuery) {
          <button matSuffix mat-icon-button (click)="searchQuery = ''">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      } @else {
        <mat-selection-list [multiple]="false" class="country-list">
          @for (country of filteredCountries(); track country.id) {
            <mat-list-option [value]="country" (click)="selectCountry(country)">
              <mat-icon matListItemIcon>public</mat-icon>
              <span matListItemTitle>{{ country.name }}</span>
            </mat-list-option>
          }
          @if (filteredCountries().length === 0) {
            <div class="no-results">
              <mat-icon>search_off</mat-icon>
              <span>No countries match "{{ searchQuery }}"</span>
            </div>
          }
        </mat-selection-list>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 24px;
      }
      .country-list {
        max-height: 300px;
        overflow-y: auto;
      }
      .no-results {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px;
        color: var(--mat-sys-on-surface-variant, #666);
      }
      .dialog-title-icon {
        vertical-align: middle;
        margin-right: 8px;
      }
    `,
  ],
})
export class ChangeCountryDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ChangeCountryDialogComponent>);
  private readonly countriesService = inject(CountriesService);
  private readonly destroyRef = inject(DestroyRef);

  searchQuery = '';
  loading = signal(false);
  private allCountries = signal<Country[]>([]);

  filteredCountries = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const all = this.allCountries();
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.countriesService
      .getAllCountries('name')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.allCountries.set(res.countries);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selectCountry(country: Country): void {
    this.dialogRef.close({
      changed: true,
      countryId: country.id,
      countryName: country.name,
    } as ChangeCountryDialogResult);
  }

  cancel(): void {
    this.dialogRef.close({ changed: false } as ChangeCountryDialogResult);
  }
}
