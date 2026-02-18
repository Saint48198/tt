import {
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import * as GeoJSON from 'geojson';

export interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
  popup?: string;
  icon?: L.Icon | L.DivIcon;
}

export interface MapOverlay {
  type: 'country' | 'state' | 'custom';
  geoJson: GeoJSON.GeoJsonObject; // GeoJSON data
  style?: L.PathOptions;
  interactive?: boolean;
}

@Component({
  selector: 'lib-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  @Input() markers: MapMarker[] = [];
  @Input() overlays: MapOverlay[] = [];
  @Input() center: [number, number] = [39.8283, -98.5795]; // Default: Center of USA
  @Input() zoom = 4;
  @Input() height = '500px';
  @Input() width = '100%';
  @Input() enableZoom = true;
  @Input() enableDrag = true;
  @Input() fitBounds = false; // Auto-fit to markers/overlays
  @Input() showAttribution = true;

  private map!: L.Map;
  private markerLayers: L.Marker[] = [];
  private overlayLayers: L.GeoJSON[] = [];
  private initialized = false;

  ngAfterViewInit(): void {
    this.initMap();
    this.initialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['markers']) {
      this.updateMarkers();
    }

    if (changes['overlays']) {
      this.updateOverlays();
    }

    if (changes['center'] || changes['zoom']) {
      if (this.map) {
        this.map.setView(this.center, this.zoom);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Initialize the map
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.center,
      zoom: this.zoom,
      zoomControl: this.enableZoom,
      dragging: this.enableDrag,
      scrollWheelZoom: this.enableZoom,
      doubleClickZoom: this.enableZoom,
      touchZoom: this.enableZoom,
      attributionControl: this.showAttribution,
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: this.showAttribution
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        : '',
      maxZoom: 19,
    }).addTo(this.map);

    // Add markers and overlays
    this.updateMarkers();
    this.updateOverlays();

    // Fit bounds if requested
    if (this.fitBounds) {
      this.fitMapBounds();
    }
  }

  private updateMarkers(): void {
    if (!this.map) return;

    // Clear existing markers
    this.markerLayers.forEach(marker => marker.remove());
    this.markerLayers = [];

    // Add new markers
    this.markers.forEach(markerData => {
      const markerOptions: L.MarkerOptions = {};

      if (markerData.icon) {
        markerOptions.icon = markerData.icon;
      } else {
        // Use default icon with fixed paths
        markerOptions.icon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
      }

      const marker = L.marker([markerData.lat, markerData.lng], markerOptions);

      if (markerData.title) {
        marker.bindTooltip(markerData.title);
      }

      if (markerData.popup) {
        marker.bindPopup(markerData.popup);
      }

      marker.addTo(this.map);
      this.markerLayers.push(marker);
    });

    if (this.fitBounds) {
      this.fitMapBounds();
    }
  }

  private updateOverlays(): void {
    if (!this.map) return;

    // Clear existing overlays
    this.overlayLayers.forEach(overlay => overlay.remove());
    this.overlayLayers = [];

    // Add new overlays
    this.overlays.forEach(overlayData => {
      const defaultStyle: L.PathOptions = {
        fillColor: overlayData.type === 'country' ? '#3388ff' : '#ff7800',
        weight: 2,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.4,
      };

      const style = overlayData.style || defaultStyle;

      const geoJsonLayer = L.geoJSON(overlayData.geoJson, {
        style: () => style,
        interactive: overlayData.interactive !== undefined ? overlayData.interactive : true,
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.name) {
            layer.bindTooltip(feature.properties.name);
          }
        },
      });

      geoJsonLayer.addTo(this.map);
      this.overlayLayers.push(geoJsonLayer);
    });

    if (this.fitBounds) {
      this.fitMapBounds();
    }
  }

  private fitMapBounds(): void {
    if (!this.map) return;

    const bounds: L.LatLngBounds[] = [];

    // Add marker bounds
    if (this.markerLayers.length > 0) {
      const markerGroup = L.featureGroup(this.markerLayers);
      bounds.push(markerGroup.getBounds());
    }

    // Add overlay bounds
    if (this.overlayLayers.length > 0) {
      this.overlayLayers.forEach(layer => {
        bounds.push(layer.getBounds());
      });
    }

    // Fit to combined bounds
    if (bounds.length > 0) {
      let combinedBounds = bounds[0];
      for (let i = 1; i < bounds.length; i++) {
        combinedBounds = combinedBounds.extend(bounds[i]);
      }

      this.map.fitBounds(combinedBounds, {
        padding: [50, 50],
      });
    }
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public setView(center: [number, number], zoom?: number): void {
    if (this.map) {
      this.map.setView(center, zoom || this.zoom);
    }
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public addMarker(marker: MapMarker): void {
    this.markers = [...this.markers, marker];
    this.updateMarkers();
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public removeMarker(index: number): void {
    this.markers = this.markers.filter((_, i) => i !== index);
    this.updateMarkers();
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public clearMarkers(): void {
    this.markers = [];
    this.updateMarkers();
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public addOverlay(overlay: MapOverlay): void {
    this.overlays = [...this.overlays, overlay];
    this.updateOverlays();
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public removeOverlay(index: number): void {
    this.overlays = this.overlays.filter((_, i) => i !== index);
    this.updateOverlays();
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public clearOverlays(): void {
    this.overlays = [];
    this.updateOverlays();
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public invalidateSize(): void {
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 0);
    }
  }

  /**
   * @publicApi
   * Used externally in various contexts (e.g., USAGE_EXAMPLES.ts)
   */
  public getMap(): L.Map | undefined {
    return this.map;
  }
}
