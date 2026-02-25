import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TripService, Trip, PlanItem } from '../../services/trip.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.scss',
})
export class TripsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripService = inject(TripService);

  username = signal<string>('');
  trips = signal<Trip[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  tripCount = computed(() => this.trips().length);

  /** Plan-item type → icon emoji mapping */
  private readonly typeIcons: Record<string, string> = {
    flight: '✈️',
    attraction: '🏰',
    accommodation: '🏨',
    car_rental: '🚗',
    ferry: '⛴️',
    train: '🚆',
  };

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('username') ?? '';
    this.username.set(name);
    this.loadTrips();
  }

  loadTrips(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tripService.getTrips().subscribe({
      next: (trips) => {
        // Parse plan if it's a JSON string
        const parsed = trips.map((t) => ({
          ...t,
          plan: this.parsePlan(t.plan),
        }));
        this.trips.set(parsed);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load trips', err);
        this.error.set('Failed to load trips. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onTripClick(trip: Trip): void {
    this.router.navigate([`/${this.username()}/trips`, trip.id]);
  }

  /** Get the earliest start date from plan items */
  getStartDate(trip: Trip): string | null {
    if (!trip.plan?.length) return null;
    const dates = trip.plan
      .map((p) => p.startDate)
      .filter(Boolean)
      .sort();
    return dates[0] || null;
  }

  /** Get the latest end date from plan items */
  getEndDate(trip: Trip): string | null {
    if (!trip.plan?.length) return null;
    const dates = trip.plan
      .map((p) => p.endDate)
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1] || null;
  }

  /** Get unique plan item types for badge display */
  getPlanTypes(trip: Trip): { type: string; icon: string; count: number }[] {
    if (!trip.plan?.length) return [];
    const counts = new Map<string, number>();
    for (const item of trip.plan) {
      counts.set(item.type, (counts.get(item.type) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([type, count]) => ({
      type,
      icon: this.typeIcons[type] || '📍',
      count,
    }));
  }

  /** Get a formatted date range string */
  getDateRange(trip: Trip): string {
    const start = this.getStartDate(trip);
    const end = this.getEndDate(trip);
    if (!start && !end) return 'No dates set';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (start && end) return `${fmt(start)} — ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${fmt(end as string)}`;
  }

  private parsePlan(plan: unknown): PlanItem[] {
    if (Array.isArray(plan)) return plan;
    if (typeof plan === 'string') {
      try {
        const parsed = JSON.parse(plan);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}




