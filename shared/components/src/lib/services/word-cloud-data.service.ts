import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

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
export class WordCloudDataService {
  private http = inject(HttpClient);

  getWordCloudInitialData(): Observable<WordCloudInitialData> {
    console.log('Loading filter options and total count from API...');

    const filterOptions$ = this.http
      .get<WordCloudFilterOptions>('/api/tags?filterOptions=true')
      .pipe(catchError(() => of({ years: [], countries: [] })));

    const totalCount$ = this.http
      .get<{ totalCount: number }>('/api/tags/total-count')
      .pipe(catchError(() => of({ totalCount: 0 })));

    return forkJoin({
      filters: filterOptions$,
      total: totalCount$,
    }).pipe(
      map(({ filters, total }) => {
        return {
          years: filters.years || [],
          countries: filters.countries || [],
          totalTagsCount: total.totalCount || 0,
        };
      })
    );
  }
}
