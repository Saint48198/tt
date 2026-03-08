import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, EMPTY } from 'rxjs';
import { map, catchError, switchMap, tap, finalize } from 'rxjs/operators';
import * as GeoJSON from 'geojson';
import { Country, State, City, Attraction, WikipediaContent, EntityPhoto } from '@shared/types';
import { PhotoService } from './photo.service';

/** Re-export as aliases for backward compatibility */
export type ExploreCountry = Country;
export type ExploreState = State;
export type ExploreCity = City;
export type ExploreAttraction = Attraction;
export type { WikipediaContent } from '@shared/types';

// ...existing code...

/** Maps country abbreviation to the GeoJSON file path for its states/provinces */
const STATE_GEOJSON_FILES: Record<string, string> = {
  US: '/data/us-states.geojson',
  USA: '/data/us-states.geojson',
  CA: '/data/canada-provinces.geojson',
  CAN: '/data/canada-provinces.geojson',
};

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
            f.properties?.['name'] && nameSet.has((f.properties['name'] as string).toLowerCase())
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
    const params = new HttpParams().set('country_id', countryId.toString()).set('all', 'true');

    return this.http
      .get<{ states: ExploreState[] }>('/api/states', { params })
      .pipe(map((res) => res.states));
  }

  getCities(countryId: number, stateId?: number): Observable<ExploreCity[]> {
    let params = new HttpParams().set('country_id', countryId.toString()).set('limit', '100');

    if (stateId !== undefined) {
      params = params.set('state_id', stateId.toString());
    }

    return this.http
      .get<{ cities: ExploreCity[] }>('/api/cities', { params })
      .pipe(map((res) => res.cities));
  }

  getAttractions(countryId: number): Observable<ExploreAttraction[]> {
    const params = new HttpParams().set('country_id', countryId.toString()).set('limit', '100');

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

export type EntityType = 'city' | 'attraction';

/**
 * Manages the state for city/attraction detail views —
 * wiki content, photos (paginated), and lightbox.
 */
@Injectable({
  providedIn: 'root',
})
export class ExploreDetailService {
  private readonly exploreService = inject(ExploreService);
  private readonly photoService = inject(PhotoService);

  // --- Entity ---
  readonly entityType = signal<EntityType | null>(null);
  readonly city = signal<ExploreCity | null>(null);
  readonly attraction = signal<ExploreAttraction | null>(null);

  readonly entity = computed(() =>
    this.entityType() === 'city' ? this.city() : this.attraction()
  );

  // --- Wiki ---
  readonly wikiContent = signal<WikipediaContent | null>(null);
  readonly wikiLoading = signal(false);

  // --- Photos ---
  readonly photos = signal<EntityPhoto[]>([]);
  readonly photosLoading = signal(false);
  readonly photosPage = signal(1);
  readonly photosTotal = signal(0);
  readonly photosPerPage = 15;

  readonly totalPhotoPages = computed(() =>
    Math.max(1, Math.ceil(this.photosTotal() / this.photosPerPage))
  );

  private photoEntityType: 'cities' | 'attractions' | null = null;
  private photoEntityId: number | null = null;

  loadCityDetail$(city: ExploreCity): Observable<void> {
    this.reset();
    this.entityType.set('city');
    return this.exploreService.getCityById(city.id).pipe(
      catchError(() => [city]),
      tap((fullCity) => {
        this.city.set(fullCity);
        this.loadWikiContent(fullCity.wiki_term || fullCity.name);
        this.loadPhotos('cities', fullCity.id);
      }),
      switchMap(() => EMPTY)
    );
  }

  loadAttractionDetail$(attraction: ExploreAttraction): Observable<void> {
    this.reset();
    this.entityType.set('attraction');
    return this.exploreService.getAttractionById(attraction.id).pipe(
      catchError(() => [attraction]),
      tap((full) => {
        this.attraction.set(full);
        if (full.wiki_term) {
          this.loadWikiContent(full.wiki_term);
        }
        this.loadPhotos('attractions', full.id);
      }),
      switchMap(() => EMPTY)
    );
  }

  private loadWikiContent(term: string): void {
    this.wikiLoading.set(true);
    this.exploreService
      .getWikipediaContent(term)
      .pipe(
        tap((content) => this.wikiContent.set(content)),
        catchError(() => {
          this.wikiContent.set(null);
          return EMPTY;
        }),
        finalize(() => this.wikiLoading.set(false))
      )
      .subscribe();
  }

  private loadPhotos(type: 'cities' | 'attractions', id: number): void {
    this.photoEntityType = type;
    this.photoEntityId = id;
    this.photosPage.set(1);
    this.fetchPhotosPage(1);
  }

  fetchPhotosPage(page: number): void {
    if (!this.photoEntityType || !this.photoEntityId) return;
    this.photosLoading.set(true);

    const fetch$ =
      this.photoEntityType === 'cities'
        ? this.photoService.getCityPhotos(this.photoEntityId, page, this.photosPerPage)
        : this.photoService.getAttractionPhotos(this.photoEntityId, page, this.photosPerPage);

    fetch$
      .pipe(
        tap((res) => {
          this.photos.set(res.photos);
          this.photosTotal.set(res.total);
          this.photosPage.set(res.page);
        }),
        catchError(() => {
          this.photos.set([]);
          return EMPTY;
        }),
        finalize(() => this.photosLoading.set(false))
      )
      .subscribe();
  }

  photosPagePrev(): void {
    const prev = this.photosPage() - 1;
    if (prev >= 1) {
      this.fetchPhotosPage(prev);
    }
  }

  photosPageNext(): void {
    const next = this.photosPage() + 1;
    if (next <= this.totalPhotoPages()) {
      this.fetchPhotosPage(next);
    }
  }

  photosGoToPage(page: number): void {
    if (page >= 1 && page <= this.totalPhotoPages() && page !== this.photosPage()) {
      this.fetchPhotosPage(page);
    }
  }

  reset(): void {
    this.entityType.set(null);
    this.city.set(null);
    this.attraction.set(null);
    this.wikiContent.set(null);
    this.wikiLoading.set(false);
    this.photos.set([]);
    this.photosLoading.set(false);
    this.photosPage.set(1);
    this.photosTotal.set(0);
    this.photoEntityType = null;
    this.photoEntityId = null;
  }
}
