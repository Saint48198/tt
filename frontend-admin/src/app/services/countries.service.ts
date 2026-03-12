import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Country,
  CountryAlias,
  CountryListResponse,
  CountryListParams,
  CreateCountryRequest,
  CountryResponse,
} from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class CountriesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/countries';

  /**
   * Get paginated list of countries with optional sorting
   */
  getCountries(params?: CountryListParams): Observable<CountryListResponse> {
    let httpParams = new HttpParams();

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
    if (params?.sortOrder) {
      httpParams = httpParams.set('sortOrder', params.sortOrder);
    }
    if (params?.includeDisabled) {
      httpParams = httpParams.set('includeDisabled', 'true');
    }

    return this.http.get<CountryListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get all countries without pagination
   */
  getAllCountries(sortBy: CountryListParams['sortBy'] = 'name'): Observable<CountryListResponse> {
    return this.getCountries({ all: true, sortBy });
  }

  /**
   * Get a single country by ID
   */
  getCountry(id: number): Observable<Country> {
    return this.http.get<Country>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new country
   */
  createCountry(country: CreateCountryRequest): Observable<CountryResponse> {
    return this.http.post<CountryResponse>(this.apiUrl, country);
  }

  /**
   * Update an existing country
   */
  updateCountry(id: number, country: CreateCountryRequest): Observable<CountryResponse> {
    return this.http.put<CountryResponse>(`${this.apiUrl}/${id}`, country);
  }

  /**
   * Delete a country
   */
  deleteCountry(id: number): Observable<CountryResponse> {
    return this.http.delete<CountryResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get aliases for a country
   */
  getAliases(countryId: number): Observable<{ aliases: CountryAlias[] }> {
    return this.http.get<{ aliases: CountryAlias[] }>(`${this.apiUrl}/${countryId}/aliases`);
  }

  /**
   * Add an alias to a country
   */
  addAlias(countryId: number, alias: string): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.apiUrl}/${countryId}/aliases`, { alias });
  }

  /**
   * Remove an alias from a country
   */
  removeAlias(countryId: number, aliasId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${countryId}/aliases/${aliasId}`);
  }
}
