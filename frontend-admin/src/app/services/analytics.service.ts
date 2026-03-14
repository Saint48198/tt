import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EntityBreakdown {
  name: string;
  value: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface PhotosByEntity {
  entity: string;
  count: number;
}

export interface TripTimeline {
  name: string;
  startDate: string;
  endDate: string;
  planItemCount: number;
}

export interface EntityGrowth {
  month: string;
  countries: number;
  states: number;
  cities: number;
  attractions: number;
}

export interface CountriesPerRegion {
  region: string;
  count: number;
}

export interface AnalyticsData {
  entityBreakdown: EntityBreakdown[];
  photosByMonth: TimeSeriesPoint[];
  photosByEntity: PhotosByEntity[];
  tripTimeline: TripTimeline[];
  countriesPerRegion: CountriesPerRegion[];
  photosPerYear: TimeSeriesPoint[];
  entityGrowth: EntityGrowth[];
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  getAnalytics(): Observable<AnalyticsData> {
    return this.http.get<AnalyticsData>('/api/stats/analytics');
  }
}
