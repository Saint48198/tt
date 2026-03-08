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
}

