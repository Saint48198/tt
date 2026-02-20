import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PhotosService } from '../../services/photos.service';

export interface PhotoUploadDialogResult {
  uploaded: boolean;
  count: number;
}

interface FilePreview {
  file: File;
  previewUrl: string;
  name: string;
  size: string;
}

@Component({
  selector: 'app-photo-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './photo-upload-dialog.component.html',
  styleUrl: './photo-upload-dialog.component.scss',
})
export class PhotoUploadDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PhotoUploadDialogComponent>);
  private readonly photosService = inject(PhotosService);
  private readonly snackBar = inject(MatSnackBar);

  files = signal<FilePreview[]>([]);
  uploading = signal(false);
  uploadProgress = signal(0);
  dragOver = signal(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    if (event.dataTransfer?.files) {
      const imageFiles = Array.from(event.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      this.addFiles(imageFiles);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  private addFiles(newFiles: File[]): void {
    const existing = this.files();
    const existingNames = new Set(existing.map((f) => f.name));

    const previews: FilePreview[] = newFiles
      .filter((f) => !existingNames.has(f.name))
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: this.formatFileSize(file.size),
      }));

    this.files.set([...existing, ...previews]);
  }

  removeFile(index: number): void {
    const current = this.files();
    URL.revokeObjectURL(current[index].previewUrl);
    this.files.set(current.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.files().forEach((f) => URL.revokeObjectURL(f.previewUrl));
    this.files.set([]);
  }

  upload(): void {
    const fileList = this.files();
    if (fileList.length === 0) return;

    this.uploading.set(true);
    this.uploadProgress.set(0);

    const rawFiles = fileList.map((f) => f.file);

    this.photosService.uploadPhotos(rawFiles).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.uploadProgress.set(100);
        const count = res.images?.length || rawFiles.length;
        this.snackBar.open(
          `${count} photo${count > 1 ? 's' : ''} uploaded successfully`,
          'Close',
          { duration: 4000 }
        );
        // Cleanup previews
        fileList.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        this.dialogRef.close({ uploaded: true, count });
      },
      error: (err) => {
        this.uploading.set(false);
        this.snackBar.open(
          err?.error?.error || 'Upload failed',
          'Close',
          { duration: 5000 }
        );
      },
    });
  }

  cancel(): void {
    this.files().forEach((f) => URL.revokeObjectURL(f.previewUrl));
    this.dialogRef.close({ uploaded: false, count: 0 });
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}



