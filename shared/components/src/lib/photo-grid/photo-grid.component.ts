import { Component, input, output, signal } from '@angular/core';
import { ImageLoaderComponent } from '../image-loader/image-loader.component';
import { LightboxComponent } from '../lightbox/lightbox.component';
import { LightboxPhoto } from '../lightbox/lightbox.types';
import { PhotoGridItem } from './photo-grid.types';

@Component({
  selector: 'lib-photo-grid',
  imports: [ImageLoaderComponent, LightboxComponent],
  templateUrl: './photo-grid.component.html',
  styleUrl: './photo-grid.component.scss',
})
export class PhotoGridComponent {
  /** The photos to display in the grid */
  photos = input.required<PhotoGridItem[]>();

  /** Whether photos are currently loading */
  loading = input(false);

  /** Total number of photos (for pagination display) */
  total = input(0);

  /** Current page number (1-based) */
  page = input(1);

  /** Total number of pages */
  totalPages = input(1);

  /** Emitted when the user navigates to a different page */
  pageChange = output<number>();

  readonly lightboxOpen = signal(false);
  readonly lightboxIndex = signal(0);

  get lightboxPhotos(): LightboxPhoto[] {
    return this.photos().map((p) => ({ url: p.url, caption: p.caption ?? undefined }));
  }

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  onLightboxClose(): void {
    this.lightboxOpen.set(false);
  }

  onLightboxIndexChange(index: number): void {
    this.lightboxIndex.set(index);
  }

  prevPage(): void {
    const prev = this.page() - 1;
    if (prev >= 1) {
      this.pageChange.emit(prev);
    }
  }

  nextPage(): void {
    const next = this.page() + 1;
    if (next <= this.totalPages()) {
      this.pageChange.emit(next);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}
