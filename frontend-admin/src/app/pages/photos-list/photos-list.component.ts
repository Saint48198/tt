import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
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
  ],
  templateUrl: './photos-list.component.html',
  styleUrl: './photos-list.component.scss',
})
export class PhotosListComponent implements OnInit {
  private readonly photosService = inject(PhotosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  photos = signal<AdminPhoto[]>([]);
  total = signal(0);
  loading = signal(false);
  viewMode = signal<'masonry' | 'list'>('masonry');

  searchQuery = '';
  sourceFilter = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.loadPhotos();
  }

  loadPhotos(page = 1, limit = 50): void {
    this.loading.set(true);

    this.photosService
      .getAllPhotos({
        page,
        limit,
        source: this.sourceFilter || undefined,
        search: this.searchQuery || undefined,
      })
      .subscribe({
        next: (response) => {
          this.photos.set(response.photos);
          this.total.set(response.total);
          this.loading.set(false);
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

  onPageChange(event: PageEvent): void {
    this.loadPhotos(event.pageIndex + 1, event.pageSize);
  }

  onSearch(): void {
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadPhotos();
  }

  onFilterChange(): void {
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
          this.loadPhotos(
            this.paginator?.pageIndex ? this.paginator.pageIndex + 1 : 1,
            this.paginator?.pageSize || 50
          );
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
        this.loadPhotos(
          this.paginator?.pageIndex ? this.paginator.pageIndex + 1 : 1,
          this.paginator?.pageSize || 50
        );
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
