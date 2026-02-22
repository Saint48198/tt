import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ExploreCountry {
  id: number;
  name: string;
  abbreviation?: string;
  lat?: number;
  lng?: number;
  slug?: string;
  last_visited?: string;
  geo_map_id?: string;
}

export interface ExploreState {
  id: number;
  name: string;
  abbr?: string;
  country_id: number;
  country_name?: string;
  last_visited?: string;
}

export interface ExploreCity {
  id: number;
  name: string;
  lat: number;
  lng: number;
  country_name?: string;
  state_name?: string;
  last_visited?: string;
}

export interface ExploreAttraction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  is_unesco?: boolean;
  is_national_park?: boolean;
  country_name?: string;
  last_visited?: string;
  wiki_term?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExploreService {
  private readonly http = inject(HttpClient);

  getVisitedCountries(username: string): Observable<ExploreCountry[]> {
    return this.http.get<ExploreCountry[]>(
      `/api/countries/visited/${encodeURIComponent(username)}`
    );
  }

  getStates(countryId: number): Observable<ExploreState[]> {
    const params = new HttpParams()
      .set('country_id', countryId.toString())
      .set('all', 'true');

    return this.http
      .get<{ states: ExploreState[] }>('/api/states', { params })
      .pipe(map((res) => res.states));
  }

  getCities(countryId: number, stateId?: number): Observable<ExploreCity[]> {
    let params = new HttpParams()
      .set('country_id', countryId.toString())
      .set('limit', '100');

    if (stateId !== undefined) {
      params = params.set('state_id', stateId.toString());
    }

    return this.http
      .get<{ cities: ExploreCity[] }>('/api/cities', { params })
      .pipe(map((res) => res.cities));
  }

  getAttractions(countryId: number): Observable<ExploreAttraction[]> {
    const params = new HttpParams()
      .set('country_id', countryId.toString())
      .set('limit', '100');

    return this.http
      .get<{ attractions: ExploreAttraction[] }>('/api/attractions', { params })
      .pipe(map((res) => res.attractions));
  }
}

