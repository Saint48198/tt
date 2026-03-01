import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PhotosService } from '../../services/photos.service';
import { EntityPhoto } from '../../interfaces';
import {
  BulkUploadDialogComponent,
  BulkUploadDialogResult,
} from '../bulk-upload-dialog/bulk-upload-dialog.component';

@Component({
  selector: 'app-photo-gallery',
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './photo-gallery.component.html',
  styleUrl: './photo-gallery.component.scss',
})
export class PhotoGalleryComponent implements OnChanges {
  @Input({ required: true }) entityType!: 'cities' | 'attractions';
  @Input({ required: true }) entityId!: number | null;

  private readonly photosService = inject(PhotosService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  photos = signal<EntityPhoto[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Edit modal state
  editingPhoto = signal<EntityPhoto | null>(null);
  editCaption = '';
  editTags = signal<string[]>([]);
  tagInput = '';
  savingEdit = signal(false);

  // Delete confirm state
  confirmingDelete = signal<EntityPhoto | null>(null);
  deleting = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['entityId'] || changes['entityType']) && this.entityId) {
      this.loadPhotos();
    }
  }

  private loadPhotos(): void {
    if (!this.entityId) return;

    this.loading.set(true);
    this.error.set(null);

    this.photosService.getPhotosByEntity(this.entityType, this.entityId).subscribe({
      next: (response) => {
        this.photos.set(response.photos);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Failed to load photos');
        this.loading.set(false);
      },
    });
  }

  // --- Edit modal ---
  openEditModal(photo: EntityPhoto): void {
    this.editingPhoto.set(photo);
    this.editCaption = photo.caption || '';
    this.editTags.set([...(photo.tags || [])]);
    this.tagInput = '';
  }

  closeEditModal(): void {
    this.editingPhoto.set(null);
    this.editCaption = '';
    this.editTags.set([]);
    this.tagInput = '';
  }

  onEditBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeEditModal();
    }
  }

  saveCaption(): void {
    const photo = this.editingPhoto();
    if (!photo) return;

    this.savingEdit.set(true);
    const tags = this.editTags();
    this.photosService.updatePhoto(photo.id, { caption: this.editCaption || null, tags }).subscribe({
      next: () => {
        this.photos.update((list) =>
          list.map((p) => (p.id === photo.id ? { ...p, caption: this.editCaption || null, tags: [...tags] } : p))
        );
        this.snackBar.open('Photo updated', 'Close', { duration: 3000 });
        this.savingEdit.set(false);
        this.closeEditModal();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to update photo', 'Close', {
          duration: 5000,
          panelClass: 'error-snackbar',
        });
        this.savingEdit.set(false);
      },
    });
  }

  addTag(): void {
    const parts = this.tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const newTags = parts.filter((t) => !this.editTags().includes(t));
    if (newTags.length) {
      this.editTags.update((tags) => [...tags, ...newTags]);
    }
    this.tagInput = '';
  }

  onTagInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  removeTag(tag: string): void {
    this.editTags.update((tags) => tags.filter((t) => t !== tag));
  }

  // --- Delete confirmation ---
  requestDelete(event: MouseEvent, photo: EntityPhoto): void {
    event.stopPropagation();
    this.confirmingDelete.set(photo);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  onDeleteBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancelDelete();
    }
  }

  confirmDelete(): void {
    const photo = this.confirmingDelete();
    if (!photo || !this.entityId) return;

    this.deleting.set(true);
    this.photosService.deletePhoto(this.entityType, this.entityId, photo.id).subscribe({
      next: () => {
        this.photos.update((list) => list.filter((p) => p.id !== photo.id));
        this.snackBar.open('Photo deleted', 'Close', { duration: 3000 });
        this.deleting.set(false);
        this.cancelDelete();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to delete photo', 'Close', {
          duration: 5000,
          panelClass: 'error-snackbar',
        });
        this.deleting.set(false);
      },
    });
  }

  // --- Upload via shared dialog ---
  openUploadModal(): void {
    const dialogRef = this.dialog.open(BulkUploadDialogComponent, {
      data: { showCountrySelect: false },
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result: BulkUploadDialogResult | undefined) => {
      if (result?.uploaded && result.images?.length && this.entityId) {
        const photos = result.images.map((img) => ({
          photo_id: img.public_id,
          url: img.secure_url || img.url,
          caption: img.exif?.title || null,
          tags: img.exif?.keywords || [],
          latitude: img.exif?.latitude ?? null,
          longitude: img.exif?.longitude ?? null,
        }));
        this.photosService.bulkAddPhotos(this.entityType, this.entityId!, photos).subscribe({
          next: () => this.loadPhotos(),
          error: (err) => {
            this.snackBar.open(err?.error?.error || 'Failed to assign photos', 'Close', {
              duration: 5000,
              panelClass: 'error-snackbar',
            });
          },
        });
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
