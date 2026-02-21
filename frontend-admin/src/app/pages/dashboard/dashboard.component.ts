import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@shared/services';
import { DashboardMapComponent } from '../../components/dashboard-map/dashboard-map.component';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DashboardMapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);

  currentUser = toSignal(this.authService.currentUser$);
  loading = signal(true);
  error = signal<string | null>(null);

  stats = signal<DashboardStats>({
    totalUsers: 0,
    totalCountries: 0,
    totalStates: 0,
    totalCities: 0,
    totalAttractions: 0,
    totalPhotos: 0,
  });


  ngOnInit(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard stats:', err);
        this.error.set('Failed to load dashboard stats');
        this.loading.set(false);
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
