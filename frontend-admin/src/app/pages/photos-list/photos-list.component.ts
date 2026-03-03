import { Component, DestroyRef, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { filter, switchMap, catchError } from 'rxjs/operators';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PhotosService } from '../../services/photos.service';
import { AdminPhoto } from '../../interfaces';
import {
  PhotoEditDialogComponent,
  PhotoEditDialogResult,
} from '../../components/photo-edit-dialog/photo-edit-dialog.component';
import {
  BulkUploadDialogComponent,
  BulkUploadDialogResult,
} from '../../components/bulk-upload-dialog/bulk-upload-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { ImageLoaderComponent } from '@shared/components';

@Component({
  selector: 'app-photos-list',
  imports: [
    DatePipe,
    FormsModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    ImageLoaderComponent,
  ],
  templateUrl: './photos-list.component.html',
  styleUrl: './photos-list.component.scss',
})
export class PhotosListComponent implements OnInit, AfterViewInit {
  private readonly photosService = inject(PhotosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  photos = signal<AdminPhoto[]>([]);
  total = signal(0);
  loading = signal(false);
  loadingMore = signal(false);
  viewMode = signal<'masonry' | 'list'>('masonry');

  searchQuery = '';
  sourceFilter = '';
  tagsFilter = signal(false);

  // Client-side filtered photos (ensures noTags filter always works)
  filteredPhotos = computed(() => {
    const all = this.photos();
    if (this.tagsFilter()) {
      return all.filter(p => !p.tags || p.tags.length === 0);
    }
    return all;
  });

  // Infinite scroll state
  private currentPage = 1;
  private readonly pageSize = 50;
  hasMore = signal(true);
  private scrollObserver: IntersectionObserver | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    this.loadPhotos();
  }

  ngAfterViewInit(): void {
    this.setupScrollObserver();
    this.destroyRef.onDestroy(() => this.scrollObserver?.disconnect());
  }

  private setupScrollObserver(): void {
    this.scrollObserver?.disconnect();

    // Use a timeout to ensure the sentinel element is rendered
    setTimeout(() => {
      if (!this.scrollSentinel?.nativeElement) return;

      this.scrollObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (
            entry.isIntersecting &&
            this.viewMode() === 'masonry' &&
            !this.loading() &&
            !this.loadingMore() &&
            this.hasMore()
          ) {
            this.loadMorePhotos();
          }
        },
        { rootMargin: '200px' }
      );

      this.scrollObserver.observe(this.scrollSentinel.nativeElement);
    });
  }

  loadPhotos(page = 1, limit = this.pageSize): void {
    this.loading.set(true);
    this.currentPage = page;

    this.photosService
      .getAllPhotos({
        page,
        limit,
        source: this.sourceFilter || undefined,
        search: this.searchQuery || undefined,
        noTags: this.tagsFilter(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.photos.set(response.photos);
          this.total.set(response.total);
          this.hasMore.set(response.photos.length >= limit && this.filteredPhotos().length < response.total);
          this.loading.set(false);
          this.setupScrollObserver();
        },
        error: (err) => {
          this.snackBar.open(
            err?.error?.message || 'Failed to load photos',
            'Close',
            { duration: 5000, panelClass: 'error-snackbar' }
          );
          this.loading.set(false);
        },
      });
  }

  private loadMorePhotos(): void {
    this.loadingMore.set(true);
    const nextPage = this.currentPage + 1;

    this.photosService
      .getAllPhotos({
        page: nextPage,
        limit: this.pageSize,
        source: this.sourceFilter || undefined,
        search: this.searchQuery || undefined,
        noTags: this.tagsFilter(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.currentPage = nextPage;
          this.photos.update((current) => [...current, ...response.photos]);
          this.total.set(response.total);
          this.hasMore.set(response.photos.length >= this.pageSize && this.filteredPhotos().length < response.total);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.loadPhotos(event.pageIndex + 1, event.pageSize);
  }

  onSearch(): void {
    this.currentPage = 1;
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadPhotos();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadPhotos();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.onSearch();
  }

  deletePhoto(photo: AdminPhoto): void {
    if (!photo.in_database || photo.id == null) {
      this.snackBar.open('Cannot delete: photo is not in the database', 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
      return;
    }

    const photoId = photo.id;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Photo',
        message: 'Are you sure you want to delete this photo?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        icon: 'delete',
        color: 'warn',
      },
      width: '420px',
      autoFocus: false,
      panelClass: 'confirm-dialog-panel',
    }).afterClosed().pipe(
      filter((confirmed) => !!confirmed),
      switchMap(() => {
        const entityType = photo.city_id ? 'cities' as const : photo.attraction_id ? 'attractions' as const : null;
        const entityId = photo.city_id || photo.attraction_id;

        return entityType && entityId
          ? this.photosService.deletePhoto(entityType, entityId, photoId)
          : this.photosService.deletePhotoById(photoId);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.snackBar.open('Photo deleted successfully', 'Close', {
          duration: 3000,
        });
        this.photos.update((list) => list.filter((p) => p.id !== photoId));
        this.total.update((t) => t - 1);
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message || 'Failed to delete photo',
          'Close',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
      },
    });
  }

  openEditDialog(photo: AdminPhoto): void {
    const dialogRef = this.dialog.open(PhotoEditDialogComponent, {
      data: { photo },
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: PhotoEditDialogResult | undefined) => {
      if (result?.updated) {
        // Reload from page 1 to refresh data
        this.loadPhotos();
      }
    });
  }

  openUploadDialog(): void {
    const dialogRef = this.dialog.open(BulkUploadDialogComponent, {
      data: { showCountrySelect: true },
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false,
    });

    dialogRef.afterClosed().pipe(
      filter((result): result is BulkUploadDialogResult => !!(result?.uploaded && result.images?.length)),
      switchMap((result: BulkUploadDialogResult) => {
        const countryId = result.country_id ?? null;
        const saveRequests = result.images!.map((img) =>
          this.photosService.addPhotoToDb({
            photo_id: img.public_id,
            url: img.secure_url || img.url,
            caption: img.exif?.title || null,
            tags: img.exif?.keywords || [],
            latitude: img.exif?.latitude ?? null,
            longitude: img.exif?.longitude ?? null,
            country_id: countryId,
          }).pipe(catchError(() => of(null)))
        );
        return forkJoin(saveRequests);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.loadPhotos(),
      error: () => this.loadPhotos(),
    });
  }
}
