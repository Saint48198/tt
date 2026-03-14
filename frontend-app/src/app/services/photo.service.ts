import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EntityPhotosResponse, MapPhotosResponse } from '@shared/types';

export type { EntityPhoto, EntityPhotosResponse, MapPhoto, MapPhotosResponse } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  private readonly http = inject(HttpClient);

  /**
   * Get photos for a specific city (paginated)
   */
  getCityPhotos(cityId: number, page = 1, limit = 15): Observable<EntityPhotosResponse> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/cities/${cityId}`, { params })
      .pipe(catchError(() => of({ photos: [], total: 0, page, limit })));
  }

  /**
   * Get photos for a specific attraction (paginated)
   */
  getAttractionPhotos(
    attractionId: number,
    page = 1,
    limit = 15
  ): Observable<EntityPhotosResponse> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/attractions/${attractionId}`, { params })
      .pipe(catchError(() => of({ photos: [], total: 0, page, limit })));
  }

  /**
   * Get photos for a specific country (paginated)
   */
  getCountryPhotos(countryId: number, page = 1, limit = 15): Observable<EntityPhotosResponse> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/countries/${countryId}`, { params })
      .pipe(catchError(() => of({ photos: [], total: 0, page, limit })));
  }

  /**
   * Get photos for a specific state (paginated)
   */
  getStatePhotos(stateId: number, page = 1, limit = 15): Observable<EntityPhotosResponse> {
    const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/states/${stateId}`, { params })
      .pipe(catchError(() => of({ photos: [], total: 0, page, limit })));
  }

  /**
   * Get photos with location data for map display.
   * Optionally filter by city or attraction slug name.
   */
  getPhotosForMap(opts?: {
    city?: string;
    attraction?: string;
    country?: string;
    state?: string;
  }): Observable<MapPhotosResponse> {
    let params = new HttpParams();
    if (opts?.city) {
      params = params.set('city', opts.city);
    }
    if (opts?.attraction) {
      params = params.set('attraction', opts.attraction);
    }
    if (opts?.country) {
      params = params.set('country', opts.country);
    }
    if (opts?.state) {
      params = params.set('state', opts.state);
    }
    return this.http
      .get<MapPhotosResponse>('/api/photos/map', { params })
      .pipe(catchError(() => of({ photos: [] })));
  }
}
