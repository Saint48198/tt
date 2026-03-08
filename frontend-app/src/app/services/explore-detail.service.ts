import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, EMPTY } from 'rxjs';
import { switchMap, tap, finalize, catchError } from 'rxjs/operators';
import {
  ExploreService,
  ExploreCity,
  ExploreAttraction,
  WikipediaContent,
} from './explore.service';
import { PhotoService, EntityPhoto } from './photo.service';

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

  // --- Lightbox ---
  readonly lightboxOpen = signal(false);
  readonly lightboxIndex = signal(0);
  readonly lightboxImageLoading = signal(false);
  readonly lightboxImageSize = signal<{ width: number; height: number } | null>(null);

  private photoEntityType: 'cities' | 'attractions' | null = null;
  private photoEntityId: number | null = null;

  /**
   * Load a city detail: fetches full city, triggers wiki + photos.
   * Returns an Observable that completes when the city is loaded.
   */
  loadCityDetail$(city: ExploreCity): Observable<void> {
    this.reset();
    this.entityType.set('city');
    return this.exploreService.getCityById(city.id).pipe(
      catchError(() => {
        // Fallback to the basic city data we already have
        return [city];
      }),
      tap((fullCity) => {
        this.city.set(fullCity);
        this.loadWikiContent(fullCity.wiki_term || fullCity.name);
        this.loadPhotos('cities', fullCity.id);
      }),
      switchMap(() => EMPTY)
    );
  }

  /**
   * Load an attraction detail: fetches full attraction, triggers wiki + photos.
   * Returns an Observable that completes when the attraction is loaded.
   */
  loadAttractionDetail$(attraction: ExploreAttraction): Observable<void> {
    this.reset();
    this.entityType.set('attraction');
    return this.exploreService.getAttractionById(attraction.id).pipe(
      catchError(() => {
        return [attraction];
      }),
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

  // --- Wiki ---

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

  // --- Photos ---

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

  // --- Lightbox ---

  openLightbox(index: number): void {
    this.lightboxImageLoading.set(true);
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
    this.preloadAdjacentImages(index);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  lightboxPrev(): void {
    const total = this.photos().length;
    if (total === 0) return;
    this.navigateLightbox((this.lightboxIndex() - 1 + total) % total);
  }

  lightboxNext(): void {
    const total = this.photos().length;
    if (total === 0) return;
    this.navigateLightbox((this.lightboxIndex() + 1) % total);
  }

  navigateLightbox(newIndex: number): void {
    if (newIndex === this.lightboxIndex()) return;
    this.lightboxImageLoading.set(true);
    this.lightboxIndex.set(newIndex);
    this.preloadAdjacentImages(newIndex);
  }

  onLightboxImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const maxW = window.innerWidth * 0.85;
    const maxH = window.innerHeight * 0.78;
    const scale = Math.min(1, maxW / natW, maxH / natH);

    this.lightboxImageSize.set({
      width: Math.round(natW * scale),
      height: Math.round(natH * scale),
    });
    this.lightboxImageLoading.set(false);
  }

  private preloadAdjacentImages(currentIndex: number): void {
    const all = this.photos();
    const total = all.length;
    if (total <= 1) return;

    const indices = [(currentIndex + 1) % total, (currentIndex - 1 + total) % total];
    for (const i of indices) {
      const img = new Image();
      img.src = all[i].url;
    }
  }

  // --- Pagination helpers ---

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

  /** Clear all detail state */
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
    this.lightboxOpen.set(false);
    this.lightboxIndex.set(0);
    this.lightboxImageLoading.set(false);
    this.lightboxImageSize.set(null);
    this.photoEntityType = null;
    this.photoEntityId = null;
  }
}
