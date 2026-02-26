import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MapComponent, MapMarker, MapOverlay, OverlayClickEvent } from '@shared/components';
import { CountryService, Country } from '../../services/country.service';
import { Subject, EMPTY } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

/**
 * Maps GeoJSON feature names back to DB country names where they differ.
 */
const GEOJSON_TO_DB_NAME: Record<string, string> = {
  'United States of America': 'United States',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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

  onOverlayClick(event: OverlayClickEvent): void {
    this.router.navigateByUrl(event.link);
  }

  /** Find the country abbreviation for a GeoJSON feature name */
  private getCountryAbbr(featureName: string): string {
    const dbName = GEOJSON_TO_DB_NAME[featureName] || featureName;
    const country = this.countries().find(
      (c) => c.name.toLowerCase() === dbName.toLowerCase()
    );
    return country?.abbreviation || country?.name || featureName;
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
            ${c.last_visited ? `<br/><span style="color: #666;display:inline-flex;align-items:center;gap:3px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="16" fill="#fff"/><path d="M9 6v2H6v18h20V8h-3V6h-2v2H11V6H9zM7 12h18v10H7V12zm3 2v3h3v-3h-3zm5 0v3h3v-3h-3zm5 0v3h3v-3h-3zm-10 5v3h3v-3h-3zm5 0v3h3v-3h-3z" fill="#1f2937"/></svg> ${new Date(c.last_visited).toLocaleDateString()}</span>` : ''}
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
          const username = this.username();
          this.mapOverlays = geoJson.features.map((feature, i) => {
            const palette = this.countryColors[i % this.countryColors.length];
            const featureName = feature.properties?.['name'] || '';
            const abbr = this.getCountryAbbr(featureName);
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
              link: `/${username}/explore/${abbr}`,
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

