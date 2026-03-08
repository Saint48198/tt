import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InfoResult } from '@shared/types';

export type { InfoResult } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class InfoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/info';

  /**
   * Look up Wikipedia info by search term
   */
  getInfo(query: string): Observable<InfoResult> {
    const params = new HttpParams().set('query', query);
    return this.http.get<InfoResult>(this.apiUrl, { params });
  }
}

