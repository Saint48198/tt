import { Component, computed, input } from '@angular/core';
import { MapComponent, MapMarker } from '@shared/components';
import { CountryVisited } from '../../interfaces';

/**
 * Dashboard map widget showing countries visited in the last 5 years.
 * Receives data from the parent DashboardComponent.
 */
@Component({
  selector: 'app-dashboard-map',
  imports: [MapComponent],
  templateUrl: './dashboard-map.component.html',
  styleUrl: './dashboard-map.component.scss',
})
export class DashboardMapComponent {
  title = 'Countries Visited (Last 5 Years)';
  mapHeight = '400px';
  showLegend = true;

  countriesVisited = input<CountryVisited[]>([]);

  markers = computed<MapMarker[]>(() =>
    this.countriesVisited().map((cv) => ({
      lat: cv.lat,
      lng: cv.lng,
      title: cv.country,
      popup: `
        <div style="text-align: center; min-width: 120px;">
          <strong style="font-size: 1.1em;">${cv.country}</strong><br/>
          <span style="color: #666;display:inline-flex;align-items:center;gap:3px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="16" fill="#fff"/><path d="M9 6v2H6v18h20V8h-3V6h-2v2H11V6H9zM7 12h18v10H7V12zm3 2v3h3v-3h-3zm5 0v3h3v-3h-3zm5 0v3h3v-3h-3zm-10 5v3h3v-3h-3zm5 0v3h3v-3h-3z" fill="#1f2937"/></svg> Last visited: ${new Date(cv.lastVisited).toLocaleDateString()}</span>
        </div>
      `,
    }))
  );
}
