import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PlanItem {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  [key: string]: unknown;
}

export interface Trip {
  id: number;
  name: string;
  notes?: string;
  plan: PlanItem[];
  created_date?: string;
  updated_date?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TripService {
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
}

