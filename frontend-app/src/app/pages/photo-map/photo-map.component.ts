import { Component, DestroyRef, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MapComponent, MapMarker, LightboxComponent, LightboxPhoto } from '@shared/components';
import { PhotoService, MapPhoto } from '../../services/photo.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-photo-map',
  imports: [MapComponent, LightboxComponent],
  templateUrl: './photo-map.component.html',
  styleUrl: './photo-map.component.scss',
})
export class PhotoMapComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private photoService = inject(PhotoService);
  private destroyRef = inject(DestroyRef);

  username = signal('');
  private allPhotos = signal<MapPhoto[]>([]);
  selectedYear = signal<number | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  title = signal('Photos on Map');

  // Lightbox state
  lightboxOpen = signal(false);
  lightboxIndex = signal(0);
  lightboxPhotos = signal<LightboxPhoto[]>([]);

  private popupClickHandler = (event: MouseEvent) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-lightbox-url]');
    if (!btn) return;
    const url = btn.dataset['lightboxUrl'];
    if (!url) return;
    const caption = btn.dataset['lightboxCaption'] || undefined;
    // Build a single-photo array for the lightbox
    this.lightboxPhotos.set([{ url, caption }]);
    this.lightboxIndex.set(0);
    this.lightboxOpen.set(true);
  };

  /** Available years derived from loaded photos, sorted descending */
  availableYears = computed<number[]>(() => {
    const years = new Set<number>();
    for (const photo of this.allPhotos()) {
      const dateStr = photo.created_date || photo.created_at;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (!isNaN(year)) years.add(year);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  });

  /** Photos filtered by selected year */
  photos = computed<MapPhoto[]>(() => {
    const year = this.selectedYear();
    const all = this.allPhotos();
    if (!year) return all;
    return all.filter((p) => {
      const dateStr = p.created_date || p.created_at;
      if (!dateStr) return false;
      return new Date(dateStr).getFullYear() === year;
    });
  });

  markers = computed<MapMarker[]>(() => {
    const photos = this.photos();
    return photos.map((photo) => {
      const locationParts: string[] = [];
      if (photo.attraction_name) locationParts.push(photo.attraction_name);
      if (photo.city_name) locationParts.push(photo.city_name);
      if (photo.state_name) locationParts.push(photo.state_name);
      if (photo.country_name) locationParts.push(photo.country_name);
      const locationText = locationParts.join(', ') || 'Unknown location';

      return {
        lat: photo.latitude,
        lng: photo.longitude,
        title: photo.caption || locationText,
        popup: `
          <div style="text-align:center;min-width:160px;max-width:240px;">
            <button
              data-lightbox-url="${photo.url}"
              data-lightbox-caption="${photo.caption || ''}"
              style="display:block;width:100%;padding:0;border:none;background:none;cursor:zoom-in;"
              title="View full photo"
            >
              <img src="${photo.url}" alt="${photo.caption || 'Photo'}"
                style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />
            </button>
            ${photo.caption ? `<p style="margin:4px 0;font-weight:600;font-size:0.9em;">${photo.caption}</p>` : ''}
            <p style="margin:2px 0;color:#6b7280;font-size:0.8em;">${locationText}</p>
            <button
              data-lightbox-url="${photo.url}"
              data-lightbox-caption="${photo.caption || ''}"
              style="display:inline-block;margin-top:6px;padding:4px 10px;font-size:0.8em;color:#667eea;background:none;border:1px solid #667eea;border-radius:4px;cursor:pointer;font-weight:500;"
            >
              🔍 View full photo
            </button>
          </div>
        `,
        icon: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      };
    });
  });

  hasMarkers = computed(() => this.markers().length > 0);

  onLightboxClose(): void {
    this.lightboxOpen.set(false);
  }

  goBack(): void {
    this.location.back();
  }

  onYearChange(year: number | null): void {
    this.selectedYear.set(year);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.popupClickHandler);
  }

  ngOnInit(): void {
    document.addEventListener('click', this.popupClickHandler);
    let currentRoute: ActivatedRoute | null = this.route;
    while (currentRoute) {
      const uname = currentRoute.snapshot.paramMap.get('username');
      if (uname) {
        this.username.set(uname);
        break;
      }
      currentRoute = currentRoute.parent;
    }

    this.route.queryParams
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((params) =>
          this.photoService.getPhotosForMap({
            city: params['city'] || undefined,
            attraction: params['attraction'] || undefined,
            country: params['country'] || undefined,
            state: params['state'] || undefined,
          })
        ),
        catchError(() => {
          this.error.set('Failed to load photos');
          this.loading.set(false);
          return EMPTY;
        })
      )
      .subscribe((response) => {
        this.allPhotos.set(response.photos);
        this.selectedYear.set(null);
        if (response.entityName) {
          this.title.set(`${response.entityName} — Photos`);
        } else {
          this.title.set('Photos on Map');
        }
        this.loading.set(false);
      });
  }
}
