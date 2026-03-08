import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface EntityPhoto {
  id: number;
  url: string;
  caption?: string | null;
  created_at: string;
  photo_id: string;
  tags: string[];
}

export interface EntityPhotosResponse {
  photos: EntityPhoto[];
  total: number;
  page: number;
  limit: number;
}

export interface MapPhoto {
  id: number;
  url: string;
  caption: string | null;
  latitude: number;
  longitude: number;
  city_name: string | null;
  attraction_name: string | null;
  country_name: string | null;
  state_name: string | null;
  photo_id: string | null;
  created_at: string;
}

export interface MapPhotosResponse {
  photos: MapPhoto[];
  entityName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  private readonly http = inject(HttpClient);

  /**
   * Get photos for a specific city (paginated)
   */
  getCityPhotos(cityId: number, page = 1, limit = 15): Observable<EntityPhotosResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/cities/${cityId}`, { params })
      .pipe(
        catchError(() => of({ photos: [], total: 0, page, limit }))
      );
  }

  /**
   * Get photos for a specific attraction (paginated)
   */
  getAttractionPhotos(attractionId: number, page = 1, limit = 15): Observable<EntityPhotosResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/attractions/${attractionId}`, { params })
      .pipe(
        catchError(() => of({ photos: [], total: 0, page, limit }))
      );
  }

  /**
   * Get photos with location data for map display.
   * Optionally filter by city or attraction slug name.
   */
  getPhotosForMap(opts?: { city?: string; attraction?: string }): Observable<MapPhotosResponse> {
    let params = new HttpParams();
    if (opts?.city) {
      params = params.set('city', opts.city);
    }
    if (opts?.attraction) {
      params = params.set('attraction', opts.attraction);
    }
    return this.http
      .get<MapPhotosResponse>('/api/photos/map', { params })
      .pipe(
        catchError(() => of({ photos: [] }))
      );
  }
}

