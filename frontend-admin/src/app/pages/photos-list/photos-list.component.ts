import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  PhotoUploadDialogComponent,
  PhotoUploadDialogResult,
} from '../../components/photo-upload-dialog/photo-upload-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-photos-list',
  standalone: true,
  imports: [
    CommonModule,
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
  ],
  templateUrl: './photos-list.component.html',
  styleUrl: './photos-list.component.scss',
})
export class PhotosListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly photosService = inject(PhotosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

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
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
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

    const entityType = photo.city_id ? 'cities' : photo.attraction_id ? 'attractions' : null;
    const entityId = photo.city_id || photo.attraction_id;

    if (!entityType || !entityId) {
      this.snackBar.open('Cannot delete: photo is not linked to an entity', 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
      return;
    }

    const photoId = photo.id!;

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
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.photosService.deletePhoto(entityType, entityId, photoId).subscribe({
        next: () => {
          this.snackBar.open('Photo deleted successfully', 'Close', {
            duration: 3000,
          });
          // Remove from local list instead of reloading
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
    });
  }

  getEntityTypeLabel(type: string | null): string {
    if (type === 'cities') return 'City';
    if (type === 'attractions') return 'Attraction';
    return '-';
  }

  openEditDialog(photo: AdminPhoto): void {
    const dialogRef = this.dialog.open(PhotoEditDialogComponent, {
      data: { photo },
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().subscribe((result: PhotoEditDialogResult | undefined) => {
      if (result?.updated) {
        // Reload from page 1 to refresh data
        this.loadPhotos();
      }
    });
  }

  openUploadDialog(): void {
    const dialogRef = this.dialog.open(PhotoUploadDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result: PhotoUploadDialogResult | undefined) => {
      if (result?.uploaded) {
        this.loadPhotos();
      }
    });
  }
}
