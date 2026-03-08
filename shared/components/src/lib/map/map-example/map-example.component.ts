import { Component } from '@angular/core';
import { MapComponent, MapMarker, MapOverlay } from '../map.component';
import * as L from 'leaflet';

@Component({
  selector: 'lib-map-example',
  imports: [MapComponent],
  templateUrl: './map-example.component.html',
  styleUrl: './map-example.component.scss',
})
export class MapExampleComponent {
  // Example 1: Simple markers
  simpleMarkers: MapMarker[] = [
    {
      lat: 40.7128,
      lng: -74.006,
      title: 'New York City',
      popup: '<strong>New York City</strong><br/>The Big Apple',
    },
    {
      lat: 34.0522,
      lng: -118.2437,
      title: 'Los Angeles',
      popup: '<strong>Los Angeles</strong><br/>City of Angels',
    },
    {
      lat: 41.8781,
      lng: -87.6298,
      title: 'Chicago',
      popup: '<strong>Chicago</strong><br/>The Windy City',
    },
  ];

  // Example 2: Country overlay (simplified France GeoJSON)
  countryOverlay: MapOverlay[] = [
    {
      type: 'country',
      geoJson: {
        type: 'Feature',
        properties: { name: 'Sample Region' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-1.5, 47.5],
              [8.5, 47.5],
              [8.5, 42.5],
              [-1.5, 42.5],
              [-1.5, 47.5],
            ],
          ],
        },
      },
      style: {
        fillColor: '#3388ff',
        weight: 2,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.4,
      },
    },
  ];

  // Example 3: Combined markers and overlay
  franceMarkers: MapMarker[] = [
    {
      lat: 48.8566,
      lng: 2.3522,
      title: 'Paris',
      popup: '<strong>Paris</strong><br/>The City of Light<br/>⭐⭐⭐⭐⭐',
    },
    {
      lat: 43.6047,
      lng: 1.4442,
      title: 'Toulouse',
      popup: '<strong>Toulouse</strong><br/>La Ville Rose<br/>⭐⭐⭐⭐',
    },
    {
      lat: 45.764,
      lng: 4.8357,
      title: 'Lyon',
      popup: '<strong>Lyon</strong><br/>Gastronomic Capital<br/>⭐⭐⭐⭐⭐',
    },
  ];

  // Example 4: Multiple states/regions
  multipleOverlays: MapOverlay[] = [
    {
      type: 'state',
      geoJson: {
        type: 'Feature',
        properties: { name: 'Region A' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-100, 40],
              [-95, 40],
              [-95, 35],
              [-100, 35],
              [-100, 40],
            ],
          ],
        },
      },
      style: {
        fillColor: '#ff7800',
        weight: 2,
        color: 'white',
        fillOpacity: 0.5,
      },
    },
    {
      type: 'state',
      geoJson: {
        type: 'Feature',
        properties: { name: 'Region B' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-95, 40],
              [-90, 40],
              [-90, 35],
              [-95, 35],
              [-95, 40],
            ],
          ],
        },
      },
      style: {
        fillColor: '#4CAF50',
        weight: 2,
        color: 'white',
        fillOpacity: 0.5,
      },
    },
  ];

  stateMarkers: MapMarker[] = [
    {
      lat: 37.5,
      lng: -97.5,
      title: 'Location in Region A',
      popup: '<strong>Region A Location</strong>',
    },
    {
      lat: 37.5,
      lng: -92.5,
      title: 'Location in Region B',
      popup: '<strong>Region B Location</strong>',
    },
  ];

  // Example 5: Custom marker with icon
  customMarkers: MapMarker[] = [
    {
      lat: 51.5074,
      lng: -0.1278,
      title: 'London',
      popup: '<strong>London</strong><br/>United Kingdom',
      icon: L.divIcon({
        html: '📍',
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      }),
    },
    {
      lat: 48.8566,
      lng: 2.3522,
      title: 'Paris',
      popup: '<strong>Paris</strong><br/>France',
      icon: L.divIcon({
        html: '🗼',
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      }),
    },
  ];
}
