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
import { filter, switchMap } from 'rxjs';
import { DatePipe, SlicePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TripsService } from '../../services/trips.service';
import { Trip } from '../../interfaces';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

interface TripRow extends Trip {
  derivedStartDate: string | null;
  derivedEndDate: string | null;
}

@Component({
  selector: 'app-trips-list',
  imports: [
    DatePipe,
    SlicePipe,
    RouterModule,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
  ],
  templateUrl: './trips-list.component.html',
  styleUrl: './trips-list.component.scss',
})
export class TripsListComponent implements OnInit, AfterViewInit {
  private readonly tripsService = inject(TripsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns: string[] = ['name', 'startDate', 'endDate', 'notes', 'actions'];
  dataSource = new MatTableDataSource<TripRow>([]);

  loading = signal(false);
  searchQuery = signal('');
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadTrips();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  loadTrips(): void {
    this.loading.set(true);
    this.tripsService
      .getTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (trips) => {
          this.dataSource.data = trips.map((trip) => {
            const parsed = this.parsePlan(trip);
            return {
              ...parsed,
              derivedStartDate: this.getEarliestDate(parsed),
              derivedEndDate: this.getLatestDate(parsed),
            };
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to load trips', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
        },
      });
  }

  private parsePlan(trip: Trip): Trip {
    let plan = trip.plan as any;
    if (typeof plan === 'string') {
      try {
        plan = JSON.parse(plan);
      } catch {
        plan = [];
      }
    }
    return { ...trip, plan: Array.isArray(plan) ? plan : [] };
  }

  private getEarliestDate(trip: Trip): string | null {
    if (!trip.plan?.length) return null;
    const dates = trip.plan
      .flatMap((i) => [i.startDate, i.endDate])
      .filter(Boolean)
      .sort();
    return dates[0] || null;
  }

  private getLatestDate(trip: Trip): string | null {
    if (!trip.plan?.length) return null;
    const dates = trip.plan
      .flatMap((i) => [i.startDate, i.endDate])
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1] || null;
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.dataSource.filter = value.trim().toLowerCase();
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.dataSource.filter = '';
  }

  deleteTrip(trip: TripRow): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete Trip',
          message: `Are you sure you want to delete "${trip.name}"?`,
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
        switchMap(() => this.tripsService.deleteTrip(trip.id)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Trip deleted successfully', 'Close', {
            duration: 3000,
          });
          this.loadTrips();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to delete trip', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }
}
