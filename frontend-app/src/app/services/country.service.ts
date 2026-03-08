import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import * as GeoJSON from 'geojson';
import { Country } from '@shared/types';

export type { Country } from '@shared/types';

/**
 * Maps DB country names to GeoJSON feature names where they differ.
 */
const NAME_ALIASES: Record<string, string> = {
  'United States': 'United States of America',
  'South Korea': 'South Korea',
  'Czech Republic': 'Czech Republic',
};

@Injectable({
  providedIn: 'root',
})
export class CountryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/countries';

  private worldGeoJson: GeoJSON.FeatureCollection | null = null;

  /**
   * Get all visited countries for a specific user
   */
  getVisitedCountries(username: string): Observable<Country[]> {
    return this.http.get<Country[]>(`${this.apiUrl}/visited/${encodeURIComponent(username)}`);
  }

  /**
   * Load the local world GeoJSON and filter to only features matching the given country names.
   */
  getCountryOutlines(countryNames: string[]): Observable<GeoJSON.FeatureCollection> {
    if (countryNames.length === 0) {
      return of({ type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection);
    }

    const source$ = this.worldGeoJson
      ? of(this.worldGeoJson)
      : this.http.get<GeoJSON.FeatureCollection>('/data/countries.geojson').pipe(
          map((data) => {
            this.worldGeoJson = data;
            return data;
          })
        );

    // Build a set of names to match, including aliases
    const nameSet = new Set<string>();
    countryNames.forEach((name) => {
      nameSet.add(name.toLowerCase());
      const alias = NAME_ALIASES[name];
      if (alias) {
        nameSet.add(alias.toLowerCase());
      }
    });

    return source$.pipe(
      map((world) => ({
        type: 'FeatureCollection' as const,
        features: world.features.filter(
          (f) => f.properties?.['name'] && nameSet.has(f.properties['name'].toLowerCase())
        ),
      }))
    );
  }
}
