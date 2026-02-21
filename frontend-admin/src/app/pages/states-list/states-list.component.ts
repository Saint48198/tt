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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { StatesService } from '../../services/states.service';
import { State } from '../../interfaces';

@Component({
  selector: 'app-states-list',
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
    MatSlideToggleModule,
  ],
  templateUrl: './states-list.component.html',
  styleUrl: './states-list.component.scss',
})
export class StatesListComponent implements OnInit, AfterViewInit {
  private readonly statesService = inject(StatesService);
  private readonly snackBar = inject(MatSnackBar);

  displayedColumns: string[] = ['name', 'abbr', 'country_name', 'last_visited', 'actions'];
  dataSource = new MatTableDataSource<State>([]);

  total = signal(0);
  loading = signal(false);
  includeDisabled = signal(false);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadStates();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  loadStates(page = 1, limit = 25, sortBy = 'name', sortOrder: 'asc' | 'desc' = 'asc'): void {
    this.loading.set(true);

    this.statesService
      .getStates({
        page,
        limit,
        sortBy: sortBy as any,
        sortOrder,
        includeDisabled: this.includeDisabled(),
      })
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.states;
          this.total.set(response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to load states',
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
    this.loadStates(
      event.pageIndex + 1,
      event.pageSize,
      sortActive,
      sortDirection as 'asc' | 'desc'
    );
  }

  onSortChange(event: Sort): void {
    const pageIndex = this.paginator?.pageIndex || 0;
    const pageSize = this.paginator?.pageSize || 25;
    this.loadStates(
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
    this.loadStates();
  }

  deleteState(state: State): void {
    if (confirm(`Are you sure you want to delete "${state.name}"?`)) {
      this.statesService.deleteState(state.id).subscribe({
        next: () => {
          this.snackBar.open('State deleted successfully', 'Close', {
            duration: 3000,
          });
          this.loadStates();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to delete state',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
        },
      });
    }
  }
}

