import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Attraction,
  AttractionListResponse,
  AttractionListParams,
  CreateAttractionRequest,
  AttractionResponse,
} from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class AttractionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/attractions';

  /**
   * Get paginated list of attractions with optional filtering and sorting
   */
  getAttractions(params?: AttractionListParams): Observable<AttractionListResponse> {
    let httpParams = new HttpParams();

    if (params?.country_id) {
      httpParams = httpParams.set('country_id', params.country_id.toString());
    }
    if (params?.state_id) {
      httpParams = httpParams.set('state_id', params.state_id.toString());
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.sortBy) {
      httpParams = httpParams.set('sortBy', params.sortBy);
    }
    if (params?.sortOrder) {
      httpParams = httpParams.set('sortOrder', params.sortOrder);
    }
    if (params?.includeDisabled) {
      httpParams = httpParams.set('includeDisabled', 'true');
    }

    return this.http.get<AttractionListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get a single attraction by ID
   */
  getAttraction(id: number): Observable<Attraction> {
    return this.http.get<Attraction>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new attraction
   */
  createAttraction(attraction: CreateAttractionRequest): Observable<AttractionResponse> {
    return this.http.post<AttractionResponse>(this.apiUrl, attraction);
  }

  /**
   * Update an existing attraction
   */
  updateAttraction(
    id: number,
    attraction: CreateAttractionRequest
  ): Observable<AttractionResponse> {
    return this.http.put<AttractionResponse>(`${this.apiUrl}/${id}`, attraction);
  }

  /**
   * Delete an attraction
   */
  deleteAttraction(id: number): Observable<AttractionResponse> {
    return this.http.delete<AttractionResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get attractions by country
   */
  getAttractionsByCountry(
    countryId: number,
    page = 1,
    limit = 25
  ): Observable<AttractionListResponse> {
    return this.getAttractions({ country_id: countryId, page, limit });
  }

  /**
   * Get UNESCO sites
   */
  getUnescoSites(page = 1, limit = 25): Observable<AttractionListResponse> {
    return this.getAttractions({ page, limit });
  }

  /**
   * Get National Parks
   */
  getNationalParks(page = 1, limit = 25): Observable<AttractionListResponse> {
    return this.getAttractions({ page, limit });
  }
}
