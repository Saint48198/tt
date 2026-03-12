import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.markercluster';
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
  geoJson: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.GeoJsonObject;
  style?: L.PathOptions;
  interactive?: boolean;
  /** Optional route to navigate to when the overlay is clicked */
  link?: string;
}

export interface OverlayClickEvent {
  link: string;
  name?: string;
  overlay: MapOverlay;
}

@Component({
  selector: 'lib-map',
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
  @Input() enableScrollZoom: boolean | null = null; // null = follow enableZoom
  @Input() enableDrag = true;
  @Input() fitBounds = false; // Auto-fit to markers/overlays
  @Input() showAttribution = true;
  @Input() enableClustering = false;
  @Input() enableClick = false;

  @Output() overlayClick = new EventEmitter<OverlayClickEvent>();
  @Output() mapClick = new EventEmitter<{ lat: number; lng: number }>();

  private map!: L.Map;
  private markerLayers: L.Marker[] = [];
  private clusterGroup: L.MarkerClusterGroup | null = null;
  private overlayLayers: L.GeoJSON[] = [];
  private initialized = false;
  private lastOverlaysRef: MapOverlay[] | null = null;
  private lastMarkersRef: MapMarker[] | null = null;

  ngAfterViewInit(): void {
    this.initMap();
    this.initialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['markers'] && this.markers !== this.lastMarkersRef) {
      this.lastMarkersRef = this.markers;
      this.updateMarkers();
    }

    if (changes['overlays'] && this.overlays !== this.lastOverlaysRef) {
      this.lastOverlaysRef = this.overlays;
      this.updateOverlays();
      // Recalculate map size in case container changed
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 50);
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
      scrollWheelZoom: this.enableScrollZoom ?? this.enableZoom,
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
    this.lastMarkersRef = this.markers;
    this.lastOverlaysRef = this.overlays;
    this.updateMarkers();
    this.updateOverlays();

    // Fit bounds if requested
    if (this.fitBounds) {
      this.fitMapBounds();
    }

    // Emit map click events if enabled
    if (this.enableClick) {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.mapClick.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    // Invalidate size after short delays to handle container sizing
    // when navigating back to a page with the map or during layout transitions
    const recalc = () => {
      if (this.map) {
        this.map.invalidateSize();
      }
    };
    setTimeout(recalc, 0);
    setTimeout(recalc, 100);
    setTimeout(recalc, 300);
  }

  private updateMarkers(): void {
    if (!this.map) return;

    // Clear existing markers and cluster group
    if (this.clusterGroup) {
      this.map.removeLayer(this.clusterGroup);
      this.clusterGroup = null;
    }
    this.markerLayers.forEach((marker) => marker.remove());
    this.markerLayers = [];

    // Build marker instances
    const markers: L.Marker[] = [];
    this.markers.forEach((markerData) => {
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

      markers.push(marker);
    });

    if (this.enableClustering && markers.length > 0) {
      this.clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div class="cluster-pin">
              <img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png" />
              <span class="cluster-count">${count}</span>
            </div>`,
            className: 'cluster-pin-wrapper',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
          });
        },
      });
      this.clusterGroup.addLayers(markers);
      this.map.addLayer(this.clusterGroup);
    } else {
      markers.forEach((m) => m.addTo(this.map));
    }

    this.markerLayers = markers;

    if (this.fitBounds) {
      this.fitMapBounds();
    }
  }

  private updateOverlays(): void {
    if (!this.map) return;

    // Clear existing overlays
    this.overlayLayers.forEach((overlay) => overlay.remove());
    this.overlayLayers = [];

    // Add new overlays
    this.overlays.forEach((overlayData) => {
      const defaultStyle: L.PathOptions = {
        fillColor: overlayData.type === 'country' ? '#3388ff' : '#ff7800',
        weight: 2,
        opacity: 1,
        color: 'white',
        fillOpacity: 0.4,
      };

      const style = overlayData.style || defaultStyle;
      const hasLink = !!overlayData.link;

      const geoJsonLayer = L.geoJSON(overlayData.geoJson as GeoJSON.GeoJsonObject, {
        style: () => style,
        interactive: overlayData.interactive !== undefined ? overlayData.interactive : true,
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.name) {
            layer.bindTooltip(feature.properties.name);
          }

          if (hasLink) {
            // Pointer cursor on hover
            layer.on('mouseover', () => {
              const el = (layer as any)._path || (layer as any).getElement?.();
              if (el) el.style.cursor = 'pointer';
            });
            layer.on('mouseout', () => {
              const el = (layer as any)._path || (layer as any).getElement?.();
              if (el) el.style.cursor = '';
            });
            // Emit click event
            layer.on('click', () => {
              this.overlayClick.emit({
                link: overlayData.link!,
                name: feature.properties?.name,
                overlay: overlayData,
              });
            });
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

    // Add marker bounds (from cluster group or individual markers)
    if (this.clusterGroup) {
      const b = this.clusterGroup.getBounds();
      if (b.isValid()) bounds.push(b);
    } else if (this.markerLayers.length > 0) {
      const markerGroup = L.featureGroup(this.markerLayers);
      bounds.push(markerGroup.getBounds());
    }

    // Add overlay bounds
    if (this.overlayLayers.length > 0) {
      this.overlayLayers.forEach((layer) => {
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
