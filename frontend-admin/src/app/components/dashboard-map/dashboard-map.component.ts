import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent, MapMarker } from '@shared/components';
import { CountryVisited } from '../../interfaces';

/**
 * Dashboard map widget showing countries visited in the last 5 years.
 * Receives data from the parent DashboardComponent.
 */
@Component({
  selector: 'app-dashboard-map',
  standalone: true,
  imports: [CommonModule, MapComponent],
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
          <span style="color: #666;display:inline-flex;align-items:center;gap:3px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="12" height="12"><circle cx="16" cy="16" r="16" fill="#1f2937"/><path d="M10 8v2H8v14h16V10h-2V8h-2v2h-8V8h-2zm-1 6h14v8H9v-8zm3 2v2h2v-2h-2zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2h-2zm4 0v2h2v-2h-2z" fill="#fff"/></svg> Last visited: ${new Date(cv.lastVisited).toLocaleDateString()}</span>
        </div>
      `,
    }))
  );
}


