import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntityPhotosResponse, UploadPhotosResponse } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class PhotosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/photos';

  /**
   * Get photos for a specific entity (city or attraction)
   */
  getPhotosByEntity(entityType: 'cities' | 'attractions', entityId: number): Observable<EntityPhotosResponse> {
    return this.http.get<EntityPhotosResponse>(`${this.apiUrl}/${entityType}/${entityId}`);
  }

  /**
   * Update a photo's caption and tags
   */
  updatePhoto(photoId: number, caption: string | null, tags?: string[]): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${photoId}`, { caption, tags });
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

