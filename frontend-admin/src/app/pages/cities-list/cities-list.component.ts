import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CitiesService } from '../../services/cities.service';
import { CountriesService } from '../../services/countries.service';
import { StatesService } from '../../services/states.service';
import { City, Country, State } from '../../interfaces';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-cities-list',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    MatDialogModule,
  ],
  templateUrl: './cities-list.component.html',
  styleUrl: './cities-list.component.scss',
})
export class CitiesListComponent implements OnInit, AfterViewInit {
  private readonly citiesService = inject(CitiesService);
  private readonly countriesService = inject(CountriesService);
  private readonly statesService = inject(StatesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  displayedColumns: string[] = [
    'name',
    'country_name',
    'state_name',
    'lat',
    'lng',
    'last_visited',
    'actions',
  ];
  dataSource = new MatTableDataSource<City>([]);

  total = signal(0);
  loading = signal(false);
  searchQuery = signal('');
  includeDisabled = signal(false);

  // Filter signals
  selectedCountryId = signal<number | null>(null);
  selectedStateId = signal<number | null>(null);
  countries = signal<Country[]>([]);
  states = signal<State[]>([]);
  filteredStates = signal<State[]>([]);

  // Country combo box (search + single select via mat-autocomplete)
  countryQuery = signal('');
  countryOptions = computed<Country[]>(() => {
    const q = this.countryQuery().trim().toLowerCase();
    const all = this.countries();
    if (!q) return all;
    return all.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.abbreviation ?? '').toLowerCase().includes(q)
    );
  });

  // Pagination / sort state (read from URL on init)
  private currentPage = 1;
  private currentLimit = 25;
  private currentSortBy = 'name';
  private currentSortOrder: 'asc' | 'desc' = 'asc';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    // Read initial filter state from URL query params
    const params = this.route.snapshot.queryParamMap;
    this.searchQuery.set(params.get('search') || '');
    this.selectedCountryId.set(params.has('country') ? Number(params.get('country')) : null);
    this.selectedStateId.set(params.has('state') ? Number(params.get('state')) : null);
    this.includeDisabled.set(params.get('disabled') === 'true');
    this.currentPage = params.has('page') ? Number(params.get('page')) : 1;
    this.currentLimit = params.has('limit') ? Number(params.get('limit')) : 25;
    this.currentSortBy = params.get('sortBy') || 'name';
    this.currentSortOrder = (params.get('sortOrder') as 'asc' | 'desc') || 'asc';

    this.loadFilterOptions();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;

    // Restore paginator / sort from URL after view initializes
    if (this.paginator) {
      this.paginator.pageIndex = this.currentPage - 1;
      this.paginator.pageSize = this.currentLimit;
    }
    if (this.sort && this.currentSortBy !== 'name') {
      this.sort.active = this.currentSortBy;
      this.sort.direction = this.currentSortOrder;
    }

    this.loadCities(this.currentPage, this.currentLimit, this.currentSortBy, this.currentSortOrder);
  }

  /** Sync current filter/pagination state to the URL without navigating away */
  private updateQueryParams(): void {
    const queryParams: Record<string, string | null> = {
      search: this.searchQuery() || null,
      country: this.selectedCountryId() != null ? String(this.selectedCountryId()) : null,
      state: this.selectedStateId() != null ? String(this.selectedStateId()) : null,
      disabled: this.includeDisabled() ? 'true' : null,
      page: this.currentPage > 1 ? String(this.currentPage) : null,
      limit: this.currentLimit !== 25 ? String(this.currentLimit) : null,
      sortBy: this.currentSortBy !== 'name' ? this.currentSortBy : null,
      sortOrder: this.currentSortOrder !== 'asc' ? this.currentSortOrder : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace',
      replaceUrl: true,
    });
  }

  loadCities(page = 1, limit = 25, sortBy = 'name', sortOrder: 'asc' | 'desc' = 'asc'): void {
    this.currentPage = page;
    this.currentLimit = limit;
    this.currentSortBy = sortBy;
    this.currentSortOrder = sortOrder;
    this.updateQueryParams();

    this.loading.set(true);

    this.citiesService
      .getCities({
        page,
        limit,
        sortBy: sortBy as 'name' | 'lat' | 'lng' | 'country_name' | 'state_name',
        sort: sortOrder,
        search: this.searchQuery() || undefined,
        includeDisabled: this.includeDisabled(),
        country_id: this.selectedCountryId() ?? undefined,
        state_id: this.selectedStateId() ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.cities;
          this.total.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to load cities', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
        },
      });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      if (this.paginator) {
        this.paginator.firstPage();
      }
      this.loadCities();
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadCities();
  }

  onPageChange(event: PageEvent): void {
    const sortActive = this.sort?.active || 'name';
    const sortDirection = this.sort?.direction || 'asc';
    this.loadCities(
      event.pageIndex + 1,
      event.pageSize,
      sortActive,
      sortDirection as 'asc' | 'desc'
    );
  }

  onSortChange(event: Sort): void {
    const pageIndex = this.paginator?.pageIndex || 0;
    const pageSize = this.paginator?.pageSize || 25;
    this.loadCities(
      pageIndex + 1,
      pageSize,
      event.active,
      (event.direction || 'asc') as 'asc' | 'desc'
    );
  }

  onToggleDisabled(checked: boolean): void {
    this.includeDisabled.set(checked);
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadCities();
  }

  private loadFilterOptions(): void {
    this.countriesService
      .getAllCountries('name')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.countries.set(res.countries);
          // Apply country filter from URL — update filteredStates + display name
          const cid = this.selectedCountryId();
          if (cid) {
            this.filteredStates.set(
              this.states().filter((s) => Number(s.country_id) === Number(cid))
            );
            const match = res.countries.find((c) => c.id === cid);
            if (match) this.countryQuery.set(match.name);
          }
        },
      });

    this.statesService
      .getAllStates('name')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.states.set(res.states);
          const cid = this.selectedCountryId();
          this.filteredStates.set(
            cid ? res.states.filter((s) => Number(s.country_id) === Number(cid)) : res.states
          );
        },
      });
  }

  /** Called on every keystroke in the country search input. */
  onCountryQueryChange(text: string): void {
    this.countryQuery.set(text);
    // Empty query means "no country filter".
    if (!text.trim()) {
      if (this.selectedCountryId() !== null) {
        this.onCountryChange(null);
      }
      return;
    }
    // If the typed text no longer matches the currently-selected country's
    // display name, clear the id filter until the user picks an option.
    const selectedId = this.selectedCountryId();
    if (selectedId !== null) {
      const selected = this.countries().find((c) => c.id === selectedId);
      if (selected && selected.name !== text) {
        this.onCountryChange(null);
      }
    }
  }

  /** User picked a country from the autocomplete panel. */
  onCountrySelected(event: MatAutocompleteSelectedEvent): void {
    const country = event.option.value as Country;
    this.countryQuery.set(country.name);
    this.onCountryChange(country.id);
  }

  /** Clear button next to the country combo box. */
  clearCountry(): void {
    this.countryQuery.set('');
    this.onCountryChange(null);
  }

  /** Display fn — keeps the option's name in the input after selection. */
  displayCountry = (country: Country | string | null): string => {
    if (!country) return '';
    return typeof country === 'string' ? country : country.name;
  };

  onCountryChange(countryId: number | null): void {
    this.selectedCountryId.set(countryId);
    // Filter states to only show those belonging to the selected country
    if (countryId) {
      this.filteredStates.set(
        this.states().filter((s) => Number(s.country_id) === Number(countryId))
      );
    } else {
      this.filteredStates.set(this.states());
    }
    // Clear state filter if it no longer matches
    const currentState = this.selectedStateId();
    if (currentState && !this.filteredStates().find((s) => s.id === currentState)) {
      this.selectedStateId.set(null);
    }
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadCities();
  }

  onStateChange(stateId: number | null): void {
    this.selectedStateId.set(stateId);
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadCities();
  }

  deleteCity(city: City): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete City',
          message: `Are you sure you want to delete "${city.name}"?`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          icon: 'delete',
          color: 'warn',
        },
        width: '420px',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => this.citiesService.deleteCity(city.id)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('City deleted successfully', 'Close', {
            duration: 3000,
          });
          this.loadCities();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to delete city', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }
}
