import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Attraction,
  AttractionAlias,
  AttractionType,
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
   * Get all attraction types
   */
  getAttractionTypes(): Observable<{ types: AttractionType[] }> {
    return this.http.get<{ types: AttractionType[] }>('/api/attraction-types');
  }

  /**
   * Create a new attraction type
   */
  createAttractionType(name: string): Observable<AttractionResponse> {
    return this.http.post<AttractionResponse>('/api/attraction-types', { name });
  }

  /**
   * Update an attraction type
   */
  updateAttractionType(id: number, name: string): Observable<AttractionResponse> {
    return this.http.put<AttractionResponse>(`/api/attraction-types/${id}`, { name });
  }

  /**
   * Delete an attraction type
   */
  deleteAttractionType(id: number): Observable<AttractionResponse> {
    return this.http.delete<AttractionResponse>(`/api/attraction-types/${id}`);
  }

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
    if (params?.all) {
      httpParams = httpParams.set('all', 'true');
    }

    return this.http.get<AttractionListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get all attractions without pagination
   */
  getAllAttractions(
    sortBy: AttractionListParams['sortBy'] = 'name'
  ): Observable<AttractionListResponse> {
    return this.getAttractions({ all: true, sortBy });
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

  // --- Alias methods ---

  /** Get all aliases for an attraction */
  getAliases(attractionId: number): Observable<{ aliases: AttractionAlias[] }> {
    return this.http.get<{ aliases: AttractionAlias[] }>(`${this.apiUrl}/${attractionId}/aliases`);
  }

  /** Add an alias to an attraction */
  addAlias(attractionId: number, alias: string): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.apiUrl}/${attractionId}/aliases`, { alias });
  }

  /** Remove an alias from an attraction */
  removeAlias(attractionId: number, aliasId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${attractionId}/aliases/${aliasId}`
    );
  }
}
