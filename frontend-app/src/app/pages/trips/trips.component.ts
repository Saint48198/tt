import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TripService, Trip, PlanItem } from '../../services/trip.service';

@Component({
  selector: 'app-trips',
  imports: [SlicePipe],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.scss',
})
export class TripsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripService = inject(TripService);
  private sanitizer = inject(DomSanitizer);

  username = signal<string>('');
  trips = signal<Trip[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  tripCount = computed(() => this.trips().length);

  private readonly svgIcon = (path: string, color = '#1f2937'): SafeHtml =>
    this.sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="18" height="18"><path d="${path}" fill="${color}"/></svg>`
    );

  /** Plan-item type → icon SVG mapping */
  private readonly typeIcons: Record<string, SafeHtml> = {
    flight: this.svgIcon('M26 16l-8-3v-7a2 2 0 10-4 0v7l-8 3v4l8-2v5l-3 2v3l5-2 5 2v-3l-3-2v-5l8 2v-4z'),
    attraction: this.svgIcon('M4 26h24v-2H4v2zM6 22h2V12H6v10zm4 0h2V14h-2v8zm4 0h2V12h-2v10zm4 0h2V14h-2v8zm4 0h2V12h-2v10zm4 0h2V14h-2v8zM4 10h24l-4-4h-4V3h-2v3h-4V3h-2v3h-4l-4 4z'),
    accommodation: this.svgIcon('M6 22h20v-4H6v4zm0-6h9v-4H8a2 2 0 00-2 2v2zm11 0h9v-2a2 2 0 00-2-2h-7v4zM6 10v1h20v-1a2 2 0 00-2-2H8a2 2 0 00-2 2z'),
    car_rental: this.svgIcon('M9 16a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm14 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM8.6 10l-1.8 5H6v2h1v4h2v-1h14v1h2v-4h1v-2h-.8l-1.8-5H8.6zm.8 2h13.2l1.2 3H8.2l1.2-3z'),
    ferry: this.svgIcon('M6 24c2 0 3-1 4-1s2 1 4 1 3-1 4-1 2 1 4 1 3-1 4-1v-2c-2 0-3 1-4 1s-2-1-4-1-3 1-4 1-2-1-4-1-3 1-4 1v2zm4-6h12l2-4h-3v-4h-6v4H9l1 4zm5-8h4v4h-4v-4z'),
    train: this.svgIcon('M10 6a2 2 0 00-2 2v10a3 3 0 003 3l-2 3h2l1.5-2h7l1.5 2h2l-2-3a3 3 0 003-3V8a2 2 0 00-2-2H10zm0 2h12v4H10V8zm0 6h4v3h-4v-3zm8 0h4v3h-4v-3zm-6 5a1 1 0 110 2 1 1 0 010-2zm8 0a1 1 0 110 2 1 1 0 010-2z'),
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
  getPlanTypes(trip: Trip): { type: string; icon: SafeHtml; count: number }[] {
    if (!trip.plan?.length) return [];
    const counts = new Map<string, number>();
    for (const item of trip.plan) {
      counts.set(item.type, (counts.get(item.type) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([type, count]) => ({
      type,
      icon: this.typeIcons[type] || this.svgIcon('M16 6a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'),
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




