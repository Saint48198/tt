# Map Component

A flexible and feature-rich map component built with Leaflet for Angular applications. Supports markers (location pointers) and overlays (country/state shapes via GeoJSON).

## Features

- 📍 **Multiple Markers**: Display location pointers with custom icons, tooltips, and popups
- 🗺️ **GeoJSON Overlays**: Show country, state, or custom shapes with configurable styles
- 🎨 **Customizable**: Full control over map appearance, zoom, center, and interactions
- 📱 **Responsive**: Configurable width and height
- 🔧 **Programmatic API**: Methods to add/remove markers and overlays dynamically
- 🎯 **Auto-fit Bounds**: Automatically adjust map view to fit all markers and overlays

## Installation

The component requires Leaflet to be installed:

```bash
npm install leaflet @types/leaflet
```

## Basic Usage

Import the component in your Angular component:

```typescript
import { MapComponent, MapMarker, MapOverlay } from '@shared/components';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [MapComponent],
  template: `
    <lib-map
      [markers]="markers"
      [overlays]="overlays"
      [center]="[40.7128, -74.0060]"
      [zoom]="10"
      height="600px"
      [fitBounds]="true">
    </lib-map>
  `
})
export class ExampleComponent {
  markers: MapMarker[] = [];
  overlays: MapOverlay[] = [];
}
```

## Examples

### Example 1: Simple Markers

```typescript
markers: MapMarker[] = [
  {
    lat: 40.7128,
    lng: -74.0060,
    title: 'New York City',
    popup: '<b>NYC</b><br>The Big Apple'
  },
  {
    lat: 34.0522,
    lng: -118.2437,
    title: 'Los Angeles',
    popup: '<b>LA</b><br>City of Angels'
  }
];
```

### Example 2: Country Overlay with GeoJSON

```typescript
// Load GeoJSON data for a country (e.g., from an API or static file)
overlays: MapOverlay[] = [
  {
    type: 'country',
    geoJson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'United States' },
          geometry: {
            type: 'Polygon',
            coordinates: [/* coordinate arrays */]
          }
        }
      ]
    },
    style: {
      fillColor: '#3388ff',
      weight: 2,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.4
    }
  }
];
```

### Example 3: State Overlay

```typescript
overlays: MapOverlay[] = [
  {
    type: 'state',
    geoJson: {
      type: 'Feature',
      properties: { name: 'California' },
      geometry: {
        type: 'Polygon',
        coordinates: [/* California boundary coordinates */]
      }
    },
    style: {
      fillColor: '#ff7800',
      weight: 2,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.5
    },
    interactive: true
  }
];
```

### Example 4: Combined Markers and Overlay

```typescript
export class TripMapComponent {
  // Show a country with visited cities
  overlays: MapOverlay[] = [
    {
      type: 'country',
      geoJson: franceGeoJson, // Your GeoJSON data
      style: {
        fillColor: '#4CAF50',
        weight: 2,
        color: '#1B5E20',
        fillOpacity: 0.3
      }
    }
  ];

  markers: MapMarker[] = [
    { lat: 48.8566, lng: 2.3522, title: 'Paris', popup: '<b>Paris</b><br>The City of Light' },
    { lat: 43.6047, lng: 1.4442, title: 'Toulouse', popup: '<b>Toulouse</b><br>La Ville Rose' },
    { lat: 45.7640, lng: 4.8357, title: 'Lyon', popup: '<b>Lyon</b><br>Gastronomic Capital' }
  ];
}
```

### Example 5: Custom Marker Icons

```typescript
import * as L from 'leaflet';

markers: MapMarker[] = [
  {
    lat: 51.5074,
    lng: -0.1278,
    title: 'London',
    popup: '<b>London</b><br>Capital of England',
    icon: L.icon({
      iconUrl: 'assets/icons/custom-marker.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    })
  }
];
```

## Component API

### Inputs

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `markers` | `MapMarker[]` | `[]` | Array of marker objects to display |
| `overlays` | `MapOverlay[]` | `[]` | Array of overlay objects (GeoJSON shapes) |
| `center` | `[number, number]` | `[39.8283, -98.5795]` | Initial map center [latitude, longitude] |
| `zoom` | `number` | `4` | Initial zoom level (0-19) |
| `height` | `string` | `'500px'` | Map container height |
| `width` | `string` | `'100%'` | Map container width |
| `enableZoom` | `boolean` | `true` | Enable zoom controls and interactions |
| `enableDrag` | `boolean` | `true` | Enable map dragging |
| `fitBounds` | `boolean` | `false` | Auto-fit map to show all markers/overlays |
| `showAttribution` | `boolean` | `true` | Show OpenStreetMap attribution |

### Public Methods

Access these methods via `@ViewChild`:

```typescript
@ViewChild(MapComponent) mapComponent!: MapComponent;

// Methods:
mapComponent.setView([lat, lng], zoom);
mapComponent.addMarker(marker);
mapComponent.removeMarker(index);
mapComponent.clearMarkers();
mapComponent.addOverlay(overlay);
mapComponent.removeOverlay(index);
mapComponent.clearOverlays();
mapComponent.invalidateSize(); // Call after resizing container
mapComponent.getMap(); // Get raw Leaflet map instance
```

## Interfaces

### MapMarker

```typescript
interface MapMarker {
  lat: number;
  lng: number;
  title?: string;        // Tooltip text
  popup?: string;        // Popup HTML content
  icon?: L.Icon | L.DivIcon;  // Custom marker icon
}
```

### MapOverlay

```typescript
interface MapOverlay {
  type: 'country' | 'state' | 'custom';
  geoJson: any;          // GeoJSON object
  style?: L.PathOptions; // Leaflet path styling options
  interactive?: boolean; // Enable mouse interactions
}
```

## GeoJSON Data Sources

You can obtain GeoJSON data for countries and states from various sources:

- **Countries**: [Natural Earth Data](https://www.naturalearthdata.com/)
- **US States**: [US Census Bureau](https://www.census.gov/geographies/mapping-files.html)
- **Custom**: Use tools like [geojson.io](https://geojson.io/) to create custom shapes

## Complete Example

```typescript
import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { MapComponent, MapMarker, MapOverlay } from '@tt/shared/components';

@Component({
  selector: 'app-trip-map',
  standalone: true,
  imports: [MapComponent],
  template: `
    <div class="map-container">
      <h2>My Trip to France</h2>
      <lib-map
        #tripMap
        [markers]="markers"
        [overlays]="overlays"
        [fitBounds]="true"
        height="600px"
        [showAttribution]="true">
      </lib-map>
      <button (click)="addCity()">Add Random City</button>
    </div>
  `
})
export class TripMapComponent implements AfterViewInit {
  @ViewChild('tripMap') mapComponent!: MapComponent;

  overlays: MapOverlay[] = [
    {
      type: 'country',
      geoJson: {
        type: 'Feature',
        properties: { name: 'France' },
        geometry: {
          type: 'Polygon',
          coordinates: [/* France boundary data */]
        }
      },
      style: {
        fillColor: '#0055A4',
        color: '#EF4135',
        weight: 3,
        fillOpacity: 0.3
      }
    }
  ];

  markers: MapMarker[] = [
    {
      lat: 48.8566,
      lng: 2.3522,
      title: 'Paris',
      popup: '<strong>Paris</strong><br>Visited: June 2025<br>⭐⭐⭐⭐⭐'
    }
  ];

  ngAfterViewInit() {
    // Map is ready
  }

  addCity() {
    this.mapComponent.addMarker({
      lat: 43.6047,
      lng: 1.4442,
      title: 'Toulouse',
      popup: '<strong>Toulouse</strong><br>To Visit'
    });
  }
}
```

## Styling

The component includes default styling, but you can customize it further in your component's stylesheet:

```scss
::ng-deep {
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .leaflet-popup-content {
    font-family: 'Your Custom Font', sans-serif;
    color: #333;
  }
}
```

## Notes

- The component uses OpenStreetMap tiles by default
- Marker icons use CDN links for default Leaflet icons
- For production, consider hosting marker icons locally
- Call `invalidateSize()` if the map container is resized dynamically
- GeoJSON coordinates use [longitude, latitude] order (opposite of Leaflet markers)


