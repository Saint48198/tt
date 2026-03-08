# Map Component - Quick Reference Guide

## Installation & Setup

### 1. Leaflet is already installed

```bash
✅ leaflet@latest
✅ @types/leaflet@latest
```

### 2. Import the component

```typescript
import { MapComponent, MapMarker, MapOverlay } from '@shared/components';

@Component({
  standalone: true,
  imports: [MapComponent],
  // ...
})
```

## Quick Start Examples

### Basic Map with Markers

```html
<lib-map [markers]="markers" [center]="[40.7128, -74.006]" [zoom]="10" height="500px"> </lib-map>
```

```typescript
markers: MapMarker[] = [
  {
    lat: 40.7128,
    lng: -74.006,
    title: 'New York',
    popup: '<b>NYC</b><br>The Big Apple'
  }
];
```

### Country/Region Overlay

```html
<lib-map [overlays]="overlays" [fitBounds]="true" height="500px"> </lib-map>
```

```typescript
overlays: MapOverlay[] = [
  {
    type: 'country',
    geoJson: countryGeoJsonData, // Your GeoJSON object
    style: {
      fillColor: '#3388ff',
      weight: 2,
      color: 'white',
      fillOpacity: 0.4
    }
  }
];
```

### Combined (Markers + Overlay)

```html
<lib-map [markers]="cities" [overlays]="countryShape" [fitBounds]="true" height="600px"> </lib-map>
```

## Common Use Cases

### 1. Show a country with cities

```typescript
// Load country shape
const franceGeoJson = await api.getCountryGeoJson('FRA');
overlays = [
  {
    type: 'country',
    geoJson: franceGeoJson,
    style: { fillColor: '#0055A4', fillOpacity: 0.3 },
  },
];

// Add city markers
markers = [
  { lat: 48.8566, lng: 2.3522, title: 'Paris' },
  { lat: 43.6047, lng: 1.4442, title: 'Toulouse' },
];
```

### 2. Show US states

```typescript
const californiaGeoJson = await api.getStateGeoJson('CA');
overlays = [
  {
    type: 'state',
    geoJson: californiaGeoJson,
    style: { fillColor: '#ff7800', fillOpacity: 0.5 },
  },
];
```

### 3. Mark visited locations

```typescript
markers = visitedCities.map((city) => ({
  lat: city.latitude,
  lng: city.longitude,
  title: city.name,
  popup: `
    <strong>${city.name}</strong><br/>
    Visited: ${city.visitDate}<br/>
    ⭐⭐⭐⭐⭐
  `,
}));
```

### 4. Custom marker icons

```typescript
import * as L from 'leaflet';

markers = [
  {
    lat: 51.5074,
    lng: -0.1278,
    title: 'London',
    icon: L.divIcon({
      html: '🏰',
      className: 'custom-icon',
      iconSize: [30, 30],
    }),
  },
];
```

## All Input Properties

| Property        | Type         | Default             | Description          |
| --------------- | ------------ | ------------------- | -------------------- |
| markers         | MapMarker[]  | []                  | Location markers     |
| overlays        | MapOverlay[] | []                  | GeoJSON shapes       |
| center          | [lat, lng]   | [39.8283, -98.5795] | Map center           |
| zoom            | number       | 4                   | Zoom level (0-19)    |
| height          | string       | '500px'             | Map height           |
| width           | string       | '100%'              | Map width            |
| enableZoom      | boolean      | true                | Enable zoom          |
| enableDrag      | boolean      | true                | Enable dragging      |
| fitBounds       | boolean      | false               | Auto-fit to content  |
| showAttribution | boolean      | true                | Show OSM attribution |

## Programmatic Control

```typescript
@ViewChild(MapComponent) map!: MapComponent;

// Change view
this.map.setView([48.8566, 2.3522], 12);

// Add/remove markers
this.map.addMarker({ lat: 48.8566, lng: 2.3522, title: 'Paris' });
this.map.removeMarker(0);
this.map.clearMarkers();

// Add/remove overlays
this.map.addOverlay({ type: 'country', geoJson: data });
this.map.removeOverlay(0);
this.map.clearOverlays();

// Refresh after resize
this.map.invalidateSize();

// Access Leaflet instance
const leafletMap = this.map.getMap();
```

## GeoJSON Data Sources

### For Countries

- [Natural Earth Data](https://www.naturalearthdata.com/) - Free country boundaries
- [REST Countries API](https://restcountries.com/) - Some include GeoJSON
- [World Atlas TopoJSON](https://github.com/topojson/world-atlas)

### For US States

- [US Census Bureau](https://www.census.gov/geographies/mapping-files.html)
- [Eric Celeste's US States GeoJSON](https://github.com/PublicaMundi/MappingAPI/tree/master/data/geojson)

### For Custom Regions

- [geojson.io](https://geojson.io/) - Draw your own shapes
- [OpenStreetMap Export](https://www.openstreetmap.org/export) - Export any region

## Styling Tips

### Custom popup styles

```scss
:host ::ng-deep {
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .leaflet-popup-content {
    font-family: 'Your Font', sans-serif;
    min-width: 200px;
  }
}
```

### Different colors per overlay

```typescript
overlays = [
  {
    type: 'state',
    geoJson: californiaGeoJson,
    style: { fillColor: '#FFD700', fillOpacity: 0.4 },
  },
  {
    type: 'state',
    geoJson: texasGeoJson,
    style: { fillColor: '#FF4500', fillOpacity: 0.4 },
  },
];
```

## Troubleshooting

### Markers not showing?

- Check lat/lng values are valid
- Ensure markers array is populated
- Try setting `fitBounds="true"`

### Map appears blank?

- Verify center coordinates are valid
- Check that container has a height set
- Call `invalidateSize()` if in a hidden/dynamic container

### GeoJSON not displaying?

- Verify GeoJSON format is valid (use [geojson.io](https://geojson.io/))
- Check coordinates are [lng, lat] in GeoJSON (opposite of markers)
- Try setting `fitBounds="true"`

### Map too small/large?

- Set explicit `height` property
- Ensure parent container has dimensions
- Call `invalidateSize()` after showing hidden map

## Performance Tips

1. **Large number of markers**: Consider clustering (use a Leaflet clustering plugin)
2. **Complex GeoJSON**: Simplify geometries to reduce size
3. **Multiple overlays**: Combine into single FeatureCollection when possible
4. **Heavy popups**: Use tooltips instead for simple info

## Complete Real-World Example

```typescript
import { Component, OnInit, ViewChild } from '@angular/core';
import { MapComponent, MapMarker, MapOverlay } from '@shared/components';

@Component({
  selector: 'app-trip-map',
  standalone: true,
  imports: [MapComponent],
  template: `
    <div class="trip-map">
      <h2>{{ tripName }}</h2>
      <lib-map
        #map
        [markers]="cityMarkers"
        [overlays]="countryOverlay"
        [fitBounds]="true"
        height="600px"
      >
      </lib-map>
      <div class="stats">{{ cityMarkers.length }} cities • {{ visitedCount }} visited</div>
    </div>
  `,
})
export class TripMapComponent implements OnInit {
  @ViewChild('map') mapComponent!: MapComponent;

  tripName = '';
  cityMarkers: MapMarker[] = [];
  countryOverlay: MapOverlay[] = [];
  visitedCount = 0;

  async ngOnInit() {
    await this.loadTripData();
  }

  async loadTripData() {
    // Fetch trip data from API
    const trip = await this.tripService.getCurrentTrip();
    this.tripName = trip.name;

    // Load country overlay
    const geoJson = await this.geoService.getCountryGeoJson(trip.countryCode);
    this.countryOverlay = [
      {
        type: 'country',
        geoJson,
        style: {
          fillColor: '#4CAF50',
          weight: 2,
          color: '#1B5E20',
          fillOpacity: 0.3,
        },
      },
    ];

    // Load city markers
    this.cityMarkers = trip.cities.map((city) => {
      const visited = city.checkInDate != null;
      if (visited) this.visitedCount++;

      return {
        lat: city.latitude,
        lng: city.longitude,
        title: city.name,
        popup: `
          <div style="min-width: 150px">
            <strong>${city.name}</strong><br/>
            ${visited ? `✅ Visited: ${city.checkInDate}` : '⏳ Not visited yet'}
          </div>
        `,
      };
    });
  }
}
```

---

**Need more help?** Check the full [README.md](./README.md) for detailed documentation.
