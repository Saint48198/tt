import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Trip, CreateTripRequest, TripResponse, CountryVisited, AnyPlanItem } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class TripsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/trips';

  /**
   * Get all trips
   */
  getTrips(): Observable<Trip[]> {
    return this.http.get<Trip[]>(this.apiUrl);
  }

  /**
   * Get a single trip by ID
   */
  getTrip(id: number): Observable<Trip> {
    return this.http.get<Trip>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new trip
   */
  createTrip(trip: CreateTripRequest & { plan?: AnyPlanItem[] }): Observable<TripResponse> {
    return this.http.post<TripResponse>(this.apiUrl, trip);
  }

  /**
   * Update an existing trip
   */
  updateTrip(id: number, trip: CreateTripRequest & { plan?: AnyPlanItem[] }): Observable<TripResponse> {
    return this.http.put<TripResponse>(`${this.apiUrl}/${id}`, trip);
  }

  /**
   * Delete a trip
   */
  deleteTrip(id: number): Observable<TripResponse> {
    return this.http.delete<TripResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get countries visited in the last 5 years with name, dates, and lat/lng
   */
  getCountriesVisited(): Observable<CountryVisited[]> {
    return this.http.get<CountryVisited[]>(`${this.apiUrl}/countries-visited`);
  }
}

