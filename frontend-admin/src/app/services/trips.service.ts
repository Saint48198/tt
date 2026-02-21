import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CountryVisited } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class TripsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/trips';

  /**
   * Get countries visited in the last 5 years with name, dates, and lat/lng
   */
  getCountriesVisited(): Observable<CountryVisited[]> {
    return this.http.get<CountryVisited[]>(`${this.apiUrl}/countries-visited`);
  }
}

