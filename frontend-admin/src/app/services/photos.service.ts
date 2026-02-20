import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntityPhotosResponse, UploadPhotosResponse, AllPhotosResponse } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class PhotosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/photos';

  /**
   * Get all photos with pagination and optional filtering (merged from Cloudinary + DB)
   */
  getAllPhotos(params: {
    page?: number;
    limit?: number;
    source?: string;
    search?: string;
  } = {}): Observable<AllPhotosResponse> {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.source) queryParams['source'] = params.source;
    if (params.search) queryParams['search'] = params.search;
    return this.http.get<AllPhotosResponse>(`${this.apiUrl}/all`, { params: queryParams });
  }

  /**
   * Get photos for a specific entity (city or attraction)
   */
  getPhotosByEntity(entityType: 'cities' | 'attractions', entityId: number): Observable<EntityPhotosResponse> {
    return this.http.get<EntityPhotosResponse>(`${this.apiUrl}/${entityType}/${entityId}`);
  }

  /**
   * Update a photo's caption, tags, and entity assignments
   */
  updatePhoto(
    photoId: number,
    data: {
      caption?: string | null;
      tags?: string[];
      city_id?: number | null;
      attraction_id?: number | null;
    }
  ): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${photoId}`, data);
  }

  /**
   * Delete a photo from an entity
   */
  deletePhoto(entityType: 'cities' | 'attractions', entityId: number, photoId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/remove/${entityType}/${entityId}`, {
      body: { photoId },
    });
  }

  /**
   * Upload files to Cloudinary
   */
  uploadPhotos(files: File[]): Observable<UploadPhotosResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return this.http.post<UploadPhotosResponse>(`${this.apiUrl}/upload`, formData);
  }

  /**
   * Associate uploaded photos with an entity
   */
  bulkAddPhotos(
    entityType: 'cities' | 'attractions',
    entityId: number,
    photos: { photo_id: string; url: string; caption?: string | null }[]
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/bulk/add`, {
      entityType,
      entityId,
      photos,
    });
  }
}

