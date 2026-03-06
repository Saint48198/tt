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
    search?: string;
    noTags?: boolean;
    entityType?: string;
    entityId?: number;
  } = {}): Observable<AllPhotosResponse> {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.entityType) queryParams['entityType'] = params.entityType;
    if (params.entityId) queryParams['entityId'] = String(params.entityId);
    if (params.search) queryParams['search'] = params.search;
    if (params.noTags === true) queryParams['noTags'] = 'true';
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
      state_id?: number | null;
      country_id?: number | null;
      latitude?: number | null;
      longitude?: number | null;
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
   * Delete a photo by its database ID (removes from S3 and database)
   */
  deletePhotoById(photoId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${photoId}`);
  }

  /**
   * Add a Cloudinary-only photo to the database with entity assignments
   */
  addPhotoToDb(data: {
    photo_id: string;
    url: string;
    caption?: string | null;
    city_id?: number | null;
    attraction_id?: number | null;
    state_id?: number | null;
    user_id?: number;
    latitude?: number | null;
    longitude?: number | null;
    country_id?: number | null;
    tags?: string[];
    created_date?: string | null;
    original_filename?: string | null;
  }): Observable<{ message: string; id: number }> {
    return this.http.post<{ message: string; id: number }>(`${this.apiUrl}/add`, data);
  }

  /**
   * Upload files to S3
   */
  uploadPhotos(files: File[], country?: string, exifData?: Array<{ title?: string; keywords?: string[]; latitude?: number; longitude?: number; created_date?: string }>): Observable<UploadPhotosResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (country) formData.append('country', country);
    if (exifData) formData.append('exifData', JSON.stringify(exifData));
    return this.http.post<UploadPhotosResponse>(`${this.apiUrl}/upload`, formData);
  }

  /**
   * Associate uploaded photos with an entity
   */
  bulkAddPhotos(
    entityType: 'cities' | 'attractions',
    entityId: number,
    photos: { photo_id: string; url: string; caption?: string | null; tags?: string[]; latitude?: number | null; longitude?: number | null }[]
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/bulk/add`, {
      entityType,
      entityId,
      photos,
    });
  }
}

