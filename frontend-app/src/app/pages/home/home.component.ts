import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MapComponent, MapMarker, MapOverlay } from '@shared/components';
import { CountryService, Country } from '../../services/country.service';
import { Subject, EMPTY } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private countryService = inject(CountryService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  username = signal<string | null>(null);
  countries = signal<Country[]>([]);
  loading = signal(false);
  hasData = computed(() => this.countries().length > 0);

  readonly mapCenter: [number, number] = [35, -30];
  readonly mapZoom = 3;

  // These are plain arrays — NOT signals — to avoid triggering repeated ngOnChanges
  mapMarkers: MapMarker[] = [];
  mapOverlays: MapOverlay[] = [];

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('username');
    if (name) {
      this.username.set(name);
      this.loadCountries(name);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildMarkers(countries: Country[]): MapMarker[] {
    return countries
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({
        lat: c.lat!,
        lng: c.lng!,
        title: c.name,
        popup: `
          <div style="text-align: center; min-width: 120px;">
            <strong style="font-size: 1.1em;">${c.name}</strong>
            ${c.last_visited ? `<br/><span style="color: #666;">📅 ${new Date(c.last_visited).toLocaleDateString()}</span>` : ''}
          </div>
        `,
      }));
  }

  // Shades of blue for country overlays
  private readonly countryColors = [
    { fill: '#1a365d', border: '#0d1b2a' },
    { fill: '#2a4a7f', border: '#1a365d' },
    { fill: '#2b6cb0', border: '#2a4a7f' },
    { fill: '#3182ce', border: '#2b6cb0' },
    { fill: '#4299e1', border: '#3182ce' },
    { fill: '#63b3ed', border: '#4299e1' },
    { fill: '#90cdf4', border: '#63b3ed' },
    { fill: '#2c5282', border: '#1a365d' },
    { fill: '#2563eb', border: '#1e40af' },
    { fill: '#3b82f6', border: '#2563eb' },
    { fill: '#60a5fa', border: '#3b82f6' },
    { fill: '#93c5fd', border: '#60a5fa' },
    { fill: '#1e40af', border: '#1e3a8a' },
    { fill: '#1d4ed8', border: '#1e40af' },
    { fill: '#0e7490', border: '#155e75' },
    { fill: '#0891b2', border: '#0e7490' },
    { fill: '#06b6d4', border: '#0891b2' },
    { fill: '#22d3ee', border: '#06b6d4' },
    { fill: '#0284c7', border: '#0369a1' },
    { fill: '#0ea5e9', border: '#0284c7' },
  ];

  private loadCountries(username: string): void {
    this.loading.set(true);

    this.countryService.getVisitedCountries(username).pipe(
      takeUntil(this.destroy$),
      switchMap((countries) => {
        this.countries.set(countries);

        const countryNames = countries.map((c) => c.name);
        if (countryNames.length === 0) {
          this.loading.set(false);
          return EMPTY;
        }

        return this.countryService.getCountryOutlines(countryNames).pipe(
          takeUntil(this.destroy$),
        );
      }),
    ).subscribe({
      next: (geoJson) => {
        if (geoJson.features.length > 0) {
          this.mapOverlays = geoJson.features.map((feature, i) => {
            const palette = this.countryColors[i % this.countryColors.length];
            return {
              type: 'country' as const,
              geoJson: {
                type: 'FeatureCollection' as const,
                features: [feature],
              },
              style: {
                fillColor: palette.fill,
                weight: 2,
                opacity: 0.8,
                color: palette.border,
                fillOpacity: 0.35,
              },
              interactive: true,
            };
          });
          this.mapMarkers = [];
        } else {
          this.mapMarkers = this.buildMarkers(this.countries());
        }
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        const countries = this.countries();
        if (countries.length > 0) {
          this.mapMarkers = this.buildMarkers(countries);
        }
        this.loading.set(false);
        this.cdr.detectChanges();
      },
    });
  }
}

