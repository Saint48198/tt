import { Component, DestroyRef, OnInit, inject, signal, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CitiesService } from '../../services/cities.service';
import { City } from '../../interfaces';
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
    MatSlideToggleModule,
    MatDialogModule,
  ],
  templateUrl: './cities-list.component.html',
  styleUrl: './cities-list.component.scss',
})
export class CitiesListComponent implements OnInit, AfterViewInit {
  private readonly citiesService = inject(CitiesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  displayedColumns: string[] = ['name', 'country_name', 'state_name', 'lat', 'lng', 'last_visited', 'actions'];
  dataSource = new MatTableDataSource<City>([]);

  total = signal(0);
  loading = signal(false);
  searchQuery = signal('');
  includeDisabled = signal(false);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadCities();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  loadCities(page = 1, limit = 25, sortBy = 'name', sortOrder: 'asc' | 'desc' = 'asc'): void {
    this.loading.set(true);

    this.citiesService
      .getCities({
        page,
        limit,
        sortBy: sortBy as 'name' | 'lat' | 'lng' | 'country_name' | 'state_name',
        sort: sortOrder,
        search: this.searchQuery() || undefined,
        includeDisabled: this.includeDisabled(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.cities;
          this.total.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to load cities',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
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

  deleteCity(city: City): void {
    this.dialog.open(ConfirmDialogComponent, {
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
    }).afterClosed().pipe(
      filter((confirmed) => !!confirmed),
      switchMap(() => this.citiesService.deleteCity(city.id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.snackBar.open('City deleted successfully', 'Close', {
          duration: 3000,
        });
        this.loadCities();
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to delete city',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
      },
    });
  }
}

