import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent, MapMarker, MapOverlay } from './map.component';
import * as GeoJSON from 'geojson';

/**
 * Example integration of the Map Component in the Trip Tracker admin dashboard
 * This demonstrates how to use the map component with real-world data
 */
@Component({
  selector: 'lib-location-map',
  standalone: true,
  imports: [CommonModule, MapComponent],
  template: `
    <div class="location-map-container">
      <h3>{{ title }}</h3>

      <!-- Map with markers and optional overlay -->
      <lib-map
        [markers]="markers"
        [overlays]="overlays"
        [center]="mapCenter"
        [zoom]="mapZoom"
        [height]="mapHeight"
        [fitBounds]="autoFit"
        [showAttribution]="true">
      </lib-map>

      <!-- Legend -->
      @if (showLegend && (markers.length > 0 || overlays.length > 0)) {
        <div class="map-legend">
          @if (markers.length > 0) {
            <div class="legend-item">
              <span class="marker-icon">📍</span>
              <span>{{ markers.length }} Location(s)</span>
            </div>
          }
          @if (overlays.length > 0) {
            <div class="legend-item">
              <span class="overlay-icon">🗺️</span>
              <span>{{ overlays.length }} Region(s)</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .location-map-container {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      h3 {
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        color: #333;
      }
    }

    .map-legend {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 6px;
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: #666;

        .marker-icon,
        .overlay-icon {
          font-size: 1.2rem;
        }
      }
    }
  `]
})
export class LocationMapComponent {
  // Configuration
  title = 'Location Map';
  mapHeight = '500px';
  mapCenter: [number, number] = [39.8283, -98.5795];
  mapZoom = 4;
  autoFit = true;
  showLegend = true;

  // Data
  markers: MapMarker[] = [];
  overlays: MapOverlay[] = [];

  /**
   * Example: Load city markers
   * In real app, this would come from an API
   */
  loadCityMarkers(cities: Array<{ name: string; lat: number; lng: number; visits?: number }>) {
    this.markers = cities.map(city => ({
      lat: city.lat,
      lng: city.lng,
      title: city.name,
      popup: `
        <strong>${city.name}</strong><br/>
        ${city.visits ? `Visits: ${city.visits}` : 'Not visited yet'}
      `
    }));
  }

  /**
   * Example: Load country/state overlay
   * In real app, geoJson would be fetched from an API or static file
   */
  loadRegionOverlay(geoJsonData: GeoJSON.GeoJsonObject, regionName: string, color: string) {
    this.overlays = [{
      type: 'country',
      geoJson: geoJsonData,
      style: {
        fillColor: color,
        weight: 2,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.4
      },
      interactive: true
    }];
    this.title = `${regionName} Map`;
  }

  /**
   * Example: Load both markers and overlay for a trip
   */
  loadTripData(tripData: {
    regionGeoJson?: GeoJSON.GeoJsonObject;
    regionName?: string;
    cities: Array<{ name: string; lat: number; lng: number; visited: boolean }>;
  }) {
    // Load markers for cities
    this.markers = tripData.cities.map(city => ({
      lat: city.lat,
      lng: city.lng,
      title: city.name,
      popup: `
        <strong>${city.name}</strong><br/>
        Status: ${city.visited ? '✅ Visited' : '⏳ Planned'}
      `
    }));

    // Load region overlay if available
    if (tripData.regionGeoJson && tripData.regionName) {
      this.overlays = [{
        type: 'country',
        geoJson: tripData.regionGeoJson,
        style: {
          fillColor: '#4CAF50',
          weight: 2,
          color: '#1B5E20',
          fillOpacity: 0.2
        }
      }];
      this.title = `Trip to ${tripData.regionName}`;
    }
  }
}

// ============================================================================
// USAGE EXAMPLES IN DIFFERENT CONTEXTS
// ============================================================================

/**
 * Example 1: Country Detail Page
 * Show a country's shape with cities as markers
 */
export const EXAMPLE_COUNTRY_USAGE = `
<!-- In your country detail component template -->
<app-location-map></app-location-map>

// In your component:
export class CountryDetailComponent implements OnInit {
  @ViewChild(LocationMapComponent) mapComponent!: LocationMapComponent;

  ngOnInit() {
    // Load country GeoJSON and cities
    this.loadCountryData();
  }

  async loadCountryData() {
    // Fetch from your API
    const countryGeoJson = await this.countryService.getCountryGeoJson('USA');
    const cities = await this.cityService.getCitiesByCountry('USA');

    this.mapComponent.loadRegionOverlay(
      countryGeoJson,
      'United States',
      '#3388ff'
    );
    this.mapComponent.loadCityMarkers(cities);
  }
}
`;

/**
 * Example 2: Trip Detail Page
 * Show trip route with visited cities
 */
export const EXAMPLE_TRIP_USAGE = `
<!-- In your trip detail component -->
<app-location-map></app-location-map>

// In your component:
export class TripDetailComponent implements OnInit {
  @ViewChild(LocationMapComponent) mapComponent!: LocationMapComponent;

  async ngOnInit() {
    const tripId = this.route.snapshot.params['id'];
    const trip = await this.tripService.getTripById(tripId);

    this.mapComponent.loadTripData({
      regionGeoJson: trip.countryGeoJson,
      regionName: trip.countryName,
      cities: trip.cities.map(c => ({
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
        visited: c.checkInDate != null
      }))
    });
  }
}
`;

/**
 * Example 3: User's Visited Locations
 * Show all cities a user has visited
 */
export const EXAMPLE_USER_MAP_USAGE = `
<!-- In user profile component -->
<app-location-map
  [mapHeight]="'600px'"
  [mapZoom]="2">
</app-location-map>

// In your component:
export class UserProfileComponent implements OnInit {
  @ViewChild(LocationMapComponent) mapComponent!: LocationMapComponent;

  async ngOnInit() {
    const userId = this.authService.currentUserId;
    const visitedCities = await this.userService.getVisitedCities(userId);

    this.mapComponent.title = 'My Travel Map';
    this.mapComponent.mapCenter = [20, 0]; // Center on world
    this.mapComponent.mapZoom = 2;
    this.mapComponent.loadCityMarkers(
      visitedCities.map(city => ({
        name: city.name,
        lat: city.latitude,
        lng: city.longitude,
        visits: city.visitCount
      }))
    );
  }
}
`;

/**
 * Example 4: Direct usage of lib-map component
 * For more control, use the map component directly
 */
export const EXAMPLE_DIRECT_USAGE = `
import { MapComponent, MapMarker, MapOverlay } from '@tt/shared/components';

@Component({
  selector: 'app-custom-map',
  standalone: true,
  imports: [MapComponent],
  template: \`
    <lib-map
      [markers]="markers"
      [overlays]="overlays"
      [center]="[48.8566, 2.3522]"
      [zoom]="6"
      height="500px"
      [fitBounds]="true">
    </lib-map>
  \`
})
export class CustomMapComponent {
  markers: MapMarker[] = [
    {
      lat: 48.8566,
      lng: 2.3522,
      title: 'Paris',
      popup: '<b>Paris</b><br/>Capital of France'
    }
  ];

  overlays: MapOverlay[] = [];

  async loadFranceMap() {
    const franceGeoJson = await fetch('/assets/geojson/france.json')
      .then(r => r.json());

    this.overlays = [{
      type: 'country',
      geoJson: franceGeoJson,
      style: {
        fillColor: '#0055A4',
        color: '#EF4135',
        weight: 3,
        fillOpacity: 0.3
      }
    }];
  }
}
`;


