import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TagService {
  private readonly http = inject(HttpClient);

  /**
   * Search tags by prefix query. Returns tags matching the pattern.
   */
  searchTags(query: string): Observable<string[]> {
    if (!query.trim()) return of([]);
    return this.http
      .get<{ tags: string[] }>(`/api/tags?query=${encodeURIComponent(query + '*')}`)
      .pipe(
        map((res) => res.tags || []),
        catchError(() => of([]))
      );
  }

  /**
   * Suggest tags for an image using AI.
   */
  suggestTags(imageUrl: string): Observable<string[]> {
    return this.http
      .post<{ tags: string[] }>('/api/tags/suggest', { imageUrl })
      .pipe(map((res) => res.tags || []));
  }

  /**
   * Suggest caption titles for an image using AI.
   */
  suggestTitles(imageUrl: string, hints: Record<string, unknown> = {}): Observable<string[]> {
    return this.http
      .post<{ suggestions: string[] }>('/api/photos/suggest-titles', { imageUrl, hints })
      .pipe(map((res) => res.suggestions || []));
  }
}
