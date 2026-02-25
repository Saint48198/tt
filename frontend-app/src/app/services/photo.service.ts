import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
}

@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  private readonly http = inject(HttpClient);

  /**
   * Get photos for a specific city
   */
  getCityPhotos(cityId: number): Observable<EntityPhoto[]> {
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/cities/${cityId}`)
      .pipe(
        map((res) => res.photos),
        catchError(() => of([]))
      );
  }

  /**
   * Get photos for a specific attraction
   */
  getAttractionPhotos(attractionId: number): Observable<EntityPhoto[]> {
    return this.http
      .get<EntityPhotosResponse>(`/api/photos/attractions/${attractionId}`)
      .pipe(
        map((res) => res.photos),
        catchError(() => of([]))
      );
  }
}

