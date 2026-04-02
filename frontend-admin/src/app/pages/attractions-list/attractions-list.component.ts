import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter, switchMap, tap } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AttractionsService } from '../../services/attractions.service';
import { CountriesService } from '../../services/countries.service';
import {
  Attraction,
  AttractionListParams,
  AttractionListResponse,
  Country,
} from '../../interfaces';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-attractions-list',
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
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatDialogModule,
  ],
  templateUrl: './attractions-list.component.html',
  styleUrl: './attractions-list.component.scss',
})
export class AttractionsListComponent implements OnInit, AfterViewInit {
  private readonly attractionsService = inject(AttractionsService);
  private readonly countriesService = inject(CountriesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  private static readonly SORT_STORAGE_KEY = 'attractions_sort';

  displayedColumns: string[] = [
    'name',
    'country_name',
    'tags',
    'lat',
    'lng',
    'last_visited',
    'updated_date',
    'actions',
  ];
  dataSource = new MatTableDataSource<Attraction>([]);

  total = signal(0);
  loading = signal(false);
  searchQuery = signal('');
  includeDisabled = signal(false);
  currentSortBy = signal('name');
  currentSortOrder = signal<'asc' | 'desc'>('asc');
  countries = signal<Country[]>([]);
  selectedCountryId = signal<number | null>(null);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.restoreSort();
    this.loading.set(true);

    // Load countries first, resolve ?country= from URL, then load attractions
    this.countriesService
      .getAllCountries('name')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((response) => {
          this.countries.set(response.countries);
          const countryParam = this.route.snapshot.queryParamMap.get('country');
          if (countryParam) {
            const normalized = countryParam.toLowerCase().replace(/-/g, ' ');
            const match = response.countries.find((c) => c.name.toLowerCase() === normalized);
            if (match) {
              this.selectedCountryId.set(match.id);
            }
          }
        }),
        switchMap(() => this.fetchAttractions())
      )
      .subscribe();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    const savedSortBy = this.currentSortBy();
    const savedSortOrder = this.currentSortOrder();
    if (this.sort && (savedSortBy !== 'name' || savedSortOrder !== 'asc')) {
      this.sort.active = savedSortBy;
      this.sort.direction = savedSortOrder;
    }
  }

  private restoreSort(): void {
    try {
      const stored = localStorage.getItem(AttractionsListComponent.SORT_STORAGE_KEY);
      if (stored) {
        const { sortBy, sortOrder } = JSON.parse(stored);
        if (sortBy) this.currentSortBy.set(sortBy);
        if (sortOrder === 'asc' || sortOrder === 'desc') this.currentSortOrder.set(sortOrder);
      }
    } catch {
      // ignore malformed data
    }
  }

  private saveSort(sortBy: string, sortOrder: 'asc' | 'desc'): void {
    this.currentSortBy.set(sortBy);
    this.currentSortOrder.set(sortOrder);
    localStorage.setItem(
      AttractionsListComponent.SORT_STORAGE_KEY,
      JSON.stringify({ sortBy, sortOrder })
    );
  }

  /**
   * Returns an observable that fetches attractions with current filter/sort/page state.
   * Handles loading flag and error display. Callers just subscribe.
   */
  private fetchAttractions(
    page = 1,
    limit = this.paginator?.pageSize || 25
  ): Observable<AttractionListResponse> {
    this.loading.set(true);

    return this.attractionsService
      .getAttractions({
        page,
        limit,
        sortBy: this.currentSortBy() as AttractionListParams['sortBy'],
        sortOrder: this.currentSortOrder(),
        search: this.searchQuery() || undefined,
        includeDisabled: this.includeDisabled(),
        country_id: this.selectedCountryId() ?? undefined,
      })
      .pipe(
        tap({
          next: (response) => {
            this.dataSource.data = response.attractions;
            this.total.set(response.total);
            this.loading.set(false);
          },
          error: (err) => {
            this.snackBar.open(err?.error?.message || 'Failed to load attractions', 'Close', {
              duration: 5000,
              panelClass: 'error-snackbar',
            });
            this.loading.set(false);
          },
        })
      );
  }

  /** Subscribe to a fetchAttractions call (used by user-driven actions) */
  private reload(page = 1): void {
    this.fetchAttractions(page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private updateCountryUrl(countryId: number | null): void {
    const country = countryId ? this.countries().find((c) => c.id === countryId) : null;
    const encodedName = country ? country.name.toLowerCase().replace(/\s+/g, '-') : null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { country: encodedName },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onCountryChange(countryId: number | null): void {
    this.selectedCountryId.set(countryId);
    this.updateCountryUrl(countryId);
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.reload();
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
      this.reload();
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.reload();
  }

  onPageChange(event: PageEvent): void {
    this.reload(event.pageIndex + 1);
  }

  onSortChange(event: Sort): void {
    const sortBy = event.active || 'name';
    const sortOrder = (event.direction || 'asc') as 'asc' | 'desc';
    this.saveSort(sortBy, sortOrder);
    this.reload((this.paginator?.pageIndex || 0) + 1);
  }

  onSortFieldChange(field: string): void {
    this.saveSort(field, this.currentSortOrder());
    if (this.paginator) this.paginator.firstPage();
    this.reload();
  }

  toggleSortOrder(): void {
    const newOrder = this.currentSortOrder() === 'asc' ? 'desc' : 'asc';
    this.saveSort(this.currentSortBy(), newOrder);
    this.reload((this.paginator?.pageIndex || 0) + 1);
  }

  onToggleDisabled(checked: boolean): void {
    this.includeDisabled.set(checked);
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.reload();
  }

  deleteAttraction(attraction: Attraction): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete Attraction',
          message: `Are you sure you want to delete "${attraction.name}"?`,
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
        switchMap(() => this.attractionsService.deleteAttraction(attraction.id)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Attraction deleted successfully', 'Close', {
            duration: 3000,
          });
          this.reload((this.paginator?.pageIndex || 0) + 1);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to delete attraction', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }
}
