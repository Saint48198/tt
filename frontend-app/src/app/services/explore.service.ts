import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as GeoJSON from 'geojson';

// ...existing code...

/** Maps country abbreviation to the GeoJSON file path for its states/provinces */
const STATE_GEOJSON_FILES: Record<string, string> = {
  US: '/data/us-states.geojson',
  USA: '/data/us-states.geojson',
  CA: '/data/canada-provinces.geojson',
  CAN: '/data/canada-provinces.geojson',
};

export interface WikipediaContent {
  title: string;
  extract: string;
  thumbnail?: string;
  url: string;
}

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
  country_id?: number;
  country_name?: string;
  state_id?: number;
  state_name?: string;
  last_visited?: string;
  wiki_term?: string;
  created_date?: string;
  updated_date?: string;
}

export interface ExploreAttraction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  is_unesco?: boolean;
  is_national_park?: boolean;
  country_id?: number;
  country_name?: string;
  last_visited?: string;
  wiki_term?: string;
  created_date?: string;
  updated_date?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExploreService {
  private readonly http = inject(HttpClient);
  private stateGeoJsonCache = new Map<string, GeoJSON.FeatureCollection>();

  // ...existing code...

  /**
   * Load state/province GeoJSON outlines for US or Canada,
   * filtered to only the given state names.
   */
  getStateOutlines(
    countryAbbr: string,
    stateNames: string[]
  ): Observable<GeoJSON.FeatureCollection> {
    const file = STATE_GEOJSON_FILES[countryAbbr];
    if (!file || stateNames.length === 0) {
      return of({ type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection);
    }

    const source$ = this.stateGeoJsonCache.has(countryAbbr)
      ? of(this.stateGeoJsonCache.get(countryAbbr)!)
      : this.http.get<GeoJSON.FeatureCollection>(file).pipe(
          map((data) => {
            this.stateGeoJsonCache.set(countryAbbr, data);
            return data;
          })
        );

    const nameSet = new Set(stateNames.map((n) => n.toLowerCase()));

    return source$.pipe(
      map((data) => ({
        type: 'FeatureCollection' as const,
        features: data.features.filter(
          (f) =>
            f.properties?.['name'] &&
            nameSet.has((f.properties['name'] as string).toLowerCase())
        ),
      }))
    );
  }

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

  getCityById(cityId: number): Observable<ExploreCity> {
    return this.http.get<ExploreCity>(`/api/cities/${cityId}`);
  }

  getAttractionById(attractionId: number): Observable<ExploreAttraction> {
    return this.http.get<ExploreAttraction>(`/api/attractions/${attractionId}`);
  }

  getWikipediaContent(wikiTerm: string): Observable<WikipediaContent | null> {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTerm)}`;
    return this.http.get<any>(url).pipe(
      map((res) => ({
        title: res.title || wikiTerm,
        extract: res.extract || '',
        thumbnail: res.thumbnail?.source || res.originalimage?.source,
        url: res.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${wikiTerm}`,
      })),
      catchError(() => of(null))
    );
  }
}

