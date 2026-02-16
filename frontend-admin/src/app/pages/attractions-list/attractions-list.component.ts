import { Component, OnInit, inject, signal, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AttractionsService } from '../../services/attractions.service';
import { Attraction } from '../../interfaces';

@Component({
  selector: 'app-attractions-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './attractions-list.component.html',
  styleUrl: './attractions-list.component.scss',
})
export class AttractionsListComponent implements OnInit, AfterViewInit {
  private readonly attractionsService = inject(AttractionsService);
  private readonly snackBar = inject(MatSnackBar);

  displayedColumns: string[] = ['name', 'country_name', 'tags', 'lat', 'lng', 'last_visited', 'actions'];
  dataSource = new MatTableDataSource<Attraction>([]);

  total = signal(0);
  loading = signal(false);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadAttractions();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  loadAttractions(page = 1, limit = 25, sortBy = 'name', sortOrder: 'asc' | 'desc' = 'asc'): void {
    this.loading.set(true);

    this.attractionsService
      .getAttractions({
        page,
        limit,
        sortBy: sortBy as 'name' | 'lat' | 'lng' | 'wiki_term' | 'country_name',
        sortOrder,
      })
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.attractions;
          this.total.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to load attractions',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    const sortActive = this.sort?.active || 'name';
    const sortDirection = this.sort?.direction || 'asc';
    this.loadAttractions(
      event.pageIndex + 1,
      event.pageSize,
      sortActive,
      sortDirection as 'asc' | 'desc'
    );
  }

  onSortChange(event: Sort): void {
    const pageIndex = this.paginator?.pageIndex || 0;
    const pageSize = this.paginator?.pageSize || 25;
    this.loadAttractions(
      pageIndex + 1,
      pageSize,
      event.active,
      (event.direction || 'asc') as 'asc' | 'desc'
    );
  }

  deleteAttraction(attraction: Attraction): void {
    if (confirm(`Are you sure you want to delete "${attraction.name}"?`)) {
      this.attractionsService.deleteAttraction(attraction.id).subscribe({
        next: () => {
          this.snackBar.open('Attraction deleted successfully', 'Close', {
            duration: 3000,
          });
          this.loadAttractions();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to delete attraction',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
        },
      });
    }
  }
}

