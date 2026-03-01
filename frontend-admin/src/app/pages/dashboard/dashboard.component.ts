import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, catchError, of, finalize } from 'rxjs';
import { AuthService } from '@shared/services';
import { DashboardMapComponent } from '../../components/dashboard-map/dashboard-map.component';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { TripsService } from '../../services/trips.service';
import { CountryVisited } from '../../interfaces';

@Component({
  selector: 'app-dashboard',
  imports: [RouterModule, DashboardMapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly tripsService = inject(TripsService);
  private destroyRef = inject(DestroyRef);

  currentUser = toSignal(this.authService.currentUser$);
  loading = signal(true);
  error = signal<string[]>([]);

  stats = signal<DashboardStats>({
    totalUsers: 0,
    totalCountries: 0,
    totalStates: 0,
    totalCities: 0,
    totalAttractions: 0,
    totalPhotos: 0,
  });

  countriesVisited = signal<CountryVisited[]>([]);

  ngOnInit(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set([]);

    forkJoin({
      stats: this.dashboardService.getStats().pipe(
        catchError((err) => {
          console.error('Failed to load dashboard stats:', err);
          this.error.update((errors) => [
            ...errors,
            'Failed to load dashboard stats. Please try again later.',
          ]);
          return of(null);
        }),
      ),
      countriesVisited: this.tripsService.getCountriesVisited().pipe(
        catchError((err) => {
          console.error('Failed to load countries visited:', err);
          this.error.update((errors) => [
            ...errors,
            'Failed to load countries visited. Please try again later.',
          ]);
          return of(null);
        }),
      ),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ stats, countriesVisited }) => {
          if (stats) this.stats.set(stats);
          if (countriesVisited) this.countriesVisited.set(countriesVisited);
        },
      });
  }


  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
