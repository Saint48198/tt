import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent, MapMarker } from '@shared/components';

/**
 * Example: Adding a world map to the admin dashboard
 * This can show popular destinations or recent activity on a map
 */
@Component({
  selector: 'app-dashboard-map',
  standalone: true,
  imports: [CommonModule, MapComponent],
  templateUrl: './dashboard-map.component.html',
  styleUrl: './dashboard-map.component.scss',
})
export class DashboardMapComponent {
  title = 'Popular Destinations';
  mapHeight = '400px';
  showLegend = true;

  // Sample data - in real app, this would come from an API
  markers: MapMarker[] = [
    {
      lat: 48.8566,
      lng: 2.3522,
      title: 'Paris',
      popup: '<strong>Paris, France</strong><br/>1,234 visits<br/>⭐⭐⭐⭐⭐'
    },
    {
      lat: 51.5074,
      lng: -0.1278,
      title: 'London',
      popup: '<strong>London, UK</strong><br/>987 visits<br/>⭐⭐⭐⭐⭐'
    },
    {
      lat: 40.7128,
      lng: -74.006,
      title: 'New York',
      popup: '<strong>New York, USA</strong><br/>856 visits<br/>⭐⭐⭐⭐⭐'
    },
    {
      lat: 35.6762,
      lng: 139.6503,
      title: 'Tokyo',
      popup: '<strong>Tokyo, Japan</strong><br/>743 visits<br/>⭐⭐⭐⭐⭐'
    },
    {
      lat: -33.8688,
      lng: 151.2093,
      title: 'Sydney',
      popup: '<strong>Sydney, Australia</strong><br/>621 visits<br/>⭐⭐⭐⭐⭐'
    },
    {
      lat: 41.9028,
      lng: 12.4964,
      title: 'Rome',
      popup: '<strong>Rome, Italy</strong><br/>589 visits<br/>⭐⭐⭐⭐⭐'
    },
    {
      lat: 25.2048,
      lng: 55.2708,
      title: 'Dubai',
      popup: '<strong>Dubai, UAE</strong><br/>512 visits<br/>⭐⭐⭐⭐'
    },
    {
      lat: 1.3521,
      lng: 103.8198,
      title: 'Singapore',
      popup: '<strong>Singapore</strong><br/>498 visits<br/>⭐⭐⭐⭐⭐'
    }
  ];
}


