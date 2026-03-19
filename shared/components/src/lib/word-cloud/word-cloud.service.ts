import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WordCloudItem } from './word-cloud.types';

export interface WordCloudFilterOptions {
  years: number[];
  countries: { id: number; name: string }[];
}

export interface WordCloudInitialData extends WordCloudFilterOptions {
  totalTagsCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class WordCloudService {
  private http = inject(HttpClient);

  /**
   * Fetch tag frequencies for the word cloud, optionally filtered by year and/or country.
   */
  getTagFrequencies(year?: number, countryId?: number): Observable<WordCloudItem[]> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (countryId) params.append('countryId', countryId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<{ tags: { tag: string; count: number }[] }>(`/api/tags${query}`).pipe(
      map((response) => response.tags.map((t) => ({ text: t.tag, count: t.count }))),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch all filter options (available years, countries) and total tag count in one call.
   */
  getInitialData(): Observable<WordCloudInitialData> {
    const filterOptions$ = this.http
      .get<WordCloudFilterOptions>('/api/tags?filterOptions=true')
      .pipe(catchError(() => of({ years: [], countries: [] })));

    const totalCount$ = this.http
      .get<{ totalCount: number }>('/api/tags/total-count')
      .pipe(catchError(() => of({ totalCount: 0 })));

    return forkJoin({ filters: filterOptions$, total: totalCount$ }).pipe(
      map(({ filters, total }) => ({
        years: filters.years || [],
        countries: filters.countries || [],
        totalTagsCount: total.totalCount || 0,
      }))
    );
  }
}
