import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WordCloudFilterGroup, WordCloudFilters, WordCloudItem } from './word-cloud.types';

export interface WordCloudFilterOptions {
  years: number[];
  countries: { id: number; name: string }[];
  states: { id: number; name: string }[];
  cities: { id: number; name: string }[];
  attractions: { id: number; name: string }[];
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
   * Fetch tag frequencies for the word cloud, optionally filtered.
   */
  getTagFrequencies(filters?: WordCloudFilters): Observable<WordCloudItem[]> {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.countryId) params.append('countryId', filters.countryId.toString());
    if (filters?.stateId) params.append('stateId', filters.stateId.toString());
    if (filters?.cityId) params.append('cityId', filters.cityId.toString());
    if (filters?.attractionId) params.append('attractionId', filters.attractionId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<{ tags: { tag: string; count: number }[] }>(`/api/tags${query}`).pipe(
      map((response) => response.tags.map((t) => ({ text: t.tag, count: t.count }))),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch filter options and total tag count.
   * Pass visibleGroups to only load options for the groups shown in the UI.
   */
  getInitialData(
    visibleGroups: WordCloudFilterGroup[] = ['time', 'location', 'place']
  ): Observable<WordCloudInitialData> {
    const needsYear = visibleGroups.includes('time');
    const needsCountry = visibleGroups.includes('location');
    const needsState = visibleGroups.includes('location');
    const needsCity = visibleGroups.includes('place');
    const needsAttraction = visibleGroups.includes('place');

    const fields: string[] = [];
    if (needsYear) fields.push('years');
    if (needsCountry) fields.push('countries');
    if (needsState) fields.push('states');
    if (needsCity) fields.push('cities');
    if (needsAttraction) fields.push('attractions');

    const filterOptions$ = this.http
      .get<WordCloudFilterOptions>(`/api/tags?filterOptions=true&fields=${fields.join(',')}`)
      .pipe(
        catchError(() => of({ years: [], countries: [], states: [], cities: [], attractions: [] }))
      );

    const totalCount$ = this.http
      .get<{ totalCount: number }>('/api/tags/total-count')
      .pipe(catchError(() => of({ totalCount: 0 })));

    return forkJoin({ filters: filterOptions$, total: totalCount$ }).pipe(
      map(({ filters, total }) => ({
        years: filters.years || [],
        countries: filters.countries || [],
        states: filters.states || [],
        cities: filters.cities || [],
        attractions: filters.attractions || [],
        totalTagsCount: total.totalCount || 0,
      }))
    );
  }
}
