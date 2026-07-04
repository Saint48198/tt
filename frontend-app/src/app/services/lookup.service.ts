import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Country } from '@shared/types';

export interface CityLookup {
  id: number;
  name: string;
  country_id: number;
  country_name?: string;
}

export interface AttractionLookup {
  id: number;
  name: string;
  country_id: number;
  country_name?: string;
}

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);

  /** All countries, sorted by name. Backend returns { countries, total }. */
  listAllCountries(): Observable<Country[]> {
    return this.http
      .get<{ countries: Country[] }>('/api/countries?all=true&sortBy=name&sortOrder=asc')
      .pipe(map((r) => r.countries ?? []));
  }

  searchCities(query: string, countryId?: number | null, limit = 20): Observable<CityLookup[]> {
    let params = new HttpParams().set('limit', String(limit)).set('search', query ?? '');
    if (countryId) params = params.set('country_id', String(countryId));
    return this.http
      .get<{ cities: CityLookup[] }>('/api/cities', { params })
      .pipe(map((r) => r.cities ?? []));
  }

  searchAttractions(
    query: string,
    countryId?: number | null,
    limit = 20
  ): Observable<AttractionLookup[]> {
    let params = new HttpParams().set('limit', String(limit)).set('search', query ?? '');
    if (countryId) params = params.set('country_id', String(countryId));
    return this.http
      .get<{ attractions: AttractionLookup[] }>('/api/attractions', { params })
      .pipe(map((r) => r.attractions ?? []));
  }
}
