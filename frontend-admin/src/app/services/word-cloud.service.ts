import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

@Injectable({
  providedIn: 'root',
})
export class WordCloudService {
  private readonly http = inject(HttpClient);

  /**
   * Get tag frequencies for word cloud
   */
  getTagFrequencies(): Observable<WordCloudItem[]> {
    return this.http.get<TagFrequencyResponse>('/api/tags/frequency/all').pipe(
      map((response) =>
        response.tags.map((t) => ({
          text: t.tag,
          count: t.count,
        }))
      )
    );
  }
}
