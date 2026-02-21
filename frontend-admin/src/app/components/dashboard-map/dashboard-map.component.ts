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
          <span style="color: #666;">📅 Last visited: ${new Date(cv.lastVisited).toLocaleDateString()}</span>
        </div>
      `,
    }))
  );
}


