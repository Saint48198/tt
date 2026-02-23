import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  City,
  CityListResponse,
  CityListParams,
  CreateCityRequest,
  CityResponse,
} from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class CitiesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/cities';

  /**
   * Get paginated list of cities with optional filtering and sorting
   */
  getCities(params?: CityListParams): Observable<CityListResponse> {
    let httpParams = new HttpParams();

    if (params?.country_id) {
      httpParams = httpParams.set('country_id', params.country_id.toString());
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
    if (params?.all) {
      httpParams = httpParams.set('all', 'true');
    }
    if (params?.sortBy) {
      httpParams = httpParams.set('sortBy', params.sortBy);
    }
    if (params?.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params?.includeDisabled) {
      httpParams = httpParams.set('includeDisabled', 'true');
    }

    return this.http.get<CityListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get all cities without pagination
   */
  getAllCities(sortBy: CityListParams['sortBy'] = 'name'): Observable<CityListResponse> {
    return this.getCities({ all: true, sortBy });
  }

  /**
   * Get cities by country
   */
  getCitiesByCountry(
    countryId: number,
    page = 1,
    limit = 25
  ): Observable<CityListResponse> {
    return this.getCities({ country_id: countryId, page, limit });
  }

  /**
   * Get a single city by ID
   */
  getCity(id: number): Observable<City> {
    return this.http.get<City>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new city
   */
  createCity(city: CreateCityRequest): Observable<CityResponse> {
    return this.http.post<CityResponse>(this.apiUrl, city);
  }

  /**
   * Update an existing city
   */
  updateCity(id: number, city: CreateCityRequest): Observable<CityResponse> {
    return this.http.put<CityResponse>(`${this.apiUrl}/${id}`, city);
  }

  /**
   * Delete a city
   */
  deleteCity(id: number): Observable<CityResponse> {
    return this.http.delete<CityResponse>(`${this.apiUrl}/${id}`);
  }
}

