import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface TagFrequency {
  tag: string;
  count: number;
}

export interface TagFrequencyResponse {
  tags: TagFrequency[];
}

export interface WordCloudItem {
  text: string;
  count: number;
}

export interface YearOption {
  year: number;
}

export interface CountryOption {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class WordCloudService {
  private readonly http = inject(HttpClient);

  /**
   * Get available years from database
   */
  getAvailableYears(): Observable<number[]> {
    return this.http
      .get<{ years: number[] }>('/api/tags/years')
      .pipe(map((response) => response.years || []));
  }

  /**
   * Get available countries from database
   */
  getAvailableCountries(): Observable<CountryOption[]> {
    return this.http
      .get<{ countries: CountryOption[] }>('/api/tags/countries')
      .pipe(map((response) => response.countries || []));
  }

  /**
   * Get tag frequencies for word cloud with optional filtering
   */
  getTagFrequencies(year?: number, countryId?: number): Observable<WordCloudItem[]> {
    let url = '/api/tags';
    const params = new URLSearchParams();

    if (year) {
      params.append('year', year.toString());
    }
    if (countryId) {
      params.append('countryId', countryId.toString());
    }

    if (params.toString()) {
      url += '?' + params.toString();
    }

    console.log('Calling API with URL:', url);

    return this.http.get<TagFrequencyResponse>(url).pipe(
      tap((response) => console.log('API Response:', response)),
      map((response) =>
        response.tags.map((t) => ({
          text: t.tag,
          count: t.count,
        }))
      )
    );
  }
}
