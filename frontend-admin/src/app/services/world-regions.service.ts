import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WorldRegion, WorldSubRegion } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class WorldRegionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/world-regions';

  /** Get all regions with their sub-regions nested */
  getRegions(): Observable<(WorldRegion & { sub_regions: WorldSubRegion[] })[]> {
    return this.http.get<(WorldRegion & { sub_regions: WorldSubRegion[] })[]>(this.apiUrl);
  }

  /** Get sub-regions for a specific region */
  getSubRegions(regionId: number): Observable<WorldSubRegion[]> {
    return this.http.get<WorldSubRegion[]>(`${this.apiUrl}/${regionId}/sub-regions`);
  }
}
