import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TripService, Trip, PlanItem } from '../../services/trip.service';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trip-detail.component.html',
  styleUrl: './trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripService = inject(TripService);

  username = signal<string>('');
  trip = signal<Trip | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  /** Plan items grouped and sorted by date */
  sortedPlan = computed<PlanItem[]>(() => {
    const t = this.trip();
    if (!t?.plan?.length) return [];
    return [...t.plan].sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const db = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return da - db;
    });
  });

  /** Plan items grouped by date */
  groupedPlan = computed(() => {
    const items = this.sortedPlan();
    const groups = new Map<string, PlanItem[]>();
    for (const item of items) {
      const key = item.startDate
        ? new Date(item.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : 'No date';
      if (!groups.has(key)) groups.set(key, []);
      const group = groups.get(key);
      if (group) group.push(item);
    }
    return Array.from(groups.entries()).map(([date, planItems]) => ({ date, items: planItems }));
  });

  /** Overall date range */
  dateRange = computed(() => {
    const t = this.trip();
    if (!t?.plan?.length) return '';
    const dates = t.plan.map((p) => p.startDate).filter(Boolean).sort();
    const endDates = t.plan.map((p) => p.endDate).filter(Boolean).sort();
    const start = dates[0];
    const end = endDates[endDates.length - 1];
    if (!start && !end) return '';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (start && end) return `${fmt(start)} — ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${fmt(end as string)}`;  });

  private readonly typeIcons: Record<string, string> = {
    flight: '✈️',
    attraction: '🏰',
    accommodation: '🏨',
    car_rental: '🚗',
    ferry: '⛴️',
    train: '🚆',
  };

  private readonly typeLabels: Record<string, string> = {
    flight: 'Flight',
    attraction: 'Attraction',
    accommodation: 'Accommodation',
    car_rental: 'Car Rental',
    ferry: 'Ferry',
    train: 'Train',
  };

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('username') ?? '';
    const id = +(this.route.snapshot.paramMap.get('id') ?? 0);
    this.username.set(name);
    this.loadTrip(id);
  }

  goBack(): void {
    this.router.navigate([`/${this.username()}/trips`]);
  }

  getIcon(type: string): string {
    return this.typeIcons[type] || '📍';
  }

  getLabel(type: string): string {
    return this.typeLabels[type] || type;
  }

  /** Build a human-readable summary for a plan item */
  getItemSummary(item: PlanItem): string {
    switch (item.type) {
      case 'flight':
        return `${item['from'] || '?'} → ${item['to'] || '?'}`;
      case 'attraction':
        return `${item['attractionName'] || 'Attraction'}`;
      case 'accommodation':
        return `${item['name'] || 'Hotel'}${item['city'] ? `, ${item['city']}` : ''}`;
      case 'car_rental':
        return `${item['company'] || 'Rental'}${item['pickupLocation'] ? ` — ${item['pickupLocation']}` : ''}`;
      case 'ferry':
      case 'train':
        return `${item['from'] || '?'} → ${item['to'] || '?'}`;
      default:
        return item.type;
    }
  }

  getItemDateRange(item: PlanItem): string {
    const fmt = (d: string) =>
      new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (item.startDate && item.endDate) {
      const sameDay = item.startDate.slice(0, 10) === item.endDate.slice(0, 10);
      if (sameDay) {
        return `${fmt(item.startDate)} – ${fmt(item.endDate)}`;
      }
      const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmtDate(item.startDate)} – ${fmtDate(item.endDate)}`;
    }
    return '';
  }

  private loadTrip(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.tripService.getTrip(id).subscribe({
      next: (trip) => {
        const plan = this.parsePlan(trip.plan);
        this.trip.set({ ...trip, plan });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load trip', err);
        this.error.set('Trip not found or could not be loaded.');
        this.loading.set(false);
      },
    });
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





