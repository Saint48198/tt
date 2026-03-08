import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ForwardGeocodeRequest,
  ReverseGeocodeResponse,
  ForwardGeocodeResponse,
} from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class GeocodeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/geocode';

  /**
   * Reverse geocode: Convert latitude/longitude to city, state, country
   */
  reverseGeocode(latitude: number, longitude: number): Observable<ReverseGeocodeResponse> {
    return this.http.post<ReverseGeocodeResponse>(this.apiUrl, {
      latitude,
      longitude,
    });
  }

  /**
   * Forward geocode: Convert city/country/place to latitude/longitude
   */
  forwardGeocode(request: ForwardGeocodeRequest): Observable<ForwardGeocodeResponse> {
    return this.http.post<ForwardGeocodeResponse>(this.apiUrl, request);
  }

  /**
   * Geocode by place name
   */
  geocodePlace(place: string): Observable<ForwardGeocodeResponse> {
    return this.http.post<ForwardGeocodeResponse>(this.apiUrl, { place });
  }

  /**
   * Geocode by city and country
   */
  geocodeCityCountry(
    city: string,
    country: string,
    state?: string
  ): Observable<ForwardGeocodeResponse> {
    return this.http.post<ForwardGeocodeResponse>(this.apiUrl, {
      city,
      country,
      state,
    });
  }
}
