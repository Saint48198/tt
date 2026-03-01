import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PhotosService } from '../../services/photos.service';
import { CountriesService } from '../../services/countries.service';
import { Country } from '../../interfaces';
import ExifReader from 'exifreader';

export interface BulkUploadDialogData {
  /** Whether to show the country select dropdown */
  showCountrySelect?: boolean;
}

export interface BulkUploadDialogResult {
  uploaded: boolean;
  count: number;
  country_id?: number | null;
  images?: Array<{
    public_id: string;
    secure_url: string;
    url: string;
    exif?: {
      title?: string;
      keywords?: string[];
      latitude?: number;
      longitude?: number;
    };
  }>;
}

interface ExifData {
  title?: string;
  keywords?: string[];
  latitude?: number;
  longitude?: number;
}

interface FilePreview {
  file: File;
  previewUrl: string;
  name: string;
  size: string;
  exif?: ExifData;
}

@Component({
  selector: 'app-bulk-upload-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './bulk-upload-dialog.component.html',
  styleUrl: './bulk-upload-dialog.component.scss',
})
export class BulkUploadDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BulkUploadDialogComponent>);
  private readonly photosService = inject(PhotosService);
  private readonly countriesService = inject(CountriesService);
  private readonly snackBar = inject(MatSnackBar);
  readonly data: BulkUploadDialogData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};

  files = signal<FilePreview[]>([]);
  uploading = signal(false);
  uploadProgress = signal(0);
  dragOver = signal(false);
  countries = signal<Country[]>([]);
  selectedCountry = signal<string>('');

  get showCountrySelect(): boolean {
    return this.data.showCountrySelect === true;
  }

  ngOnInit(): void {
    if (this.showCountrySelect) {
      this.countriesService.getAllCountries('name').subscribe({
        next: (res) => this.countries.set(res.countries),
      });
    }
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async extractExif(file: File): Promise<ExifData> {
    const exif: ExifData = {};
    try {
      const buffer = await file.arrayBuffer();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tags: any = ExifReader.load(buffer, { expanded: true });

      const xmpTitle =
        tags.xmp?.['dc:title']?.description || tags.xmp?.['title']?.description;
      const iptcTitle = tags.iptc?.['Object Name']?.description;
      const exifTitle =
        tags.exif?.['ImageDescription']?.description ||
        tags.exif?.['XPTitle']?.description;
      exif.title = xmpTitle || iptcTitle || exifTitle || undefined;

      const xmpSubject = tags.xmp?.['dc:subject'] || tags.xmp?.['subject'];
      const iptcKeywords = tags.iptc?.['Keywords'];
      const exifKeywords = tags.exif?.['XPKeywords']?.description;

      if (xmpSubject) {
        if (Array.isArray(xmpSubject)) {
          exif.keywords = xmpSubject
            .map((k: unknown) =>
              typeof k === 'string'
                ? k
                : (k as { description?: string })?.description || String(k)
            )
            .filter(Boolean);
        } else if (typeof xmpSubject === 'object' && xmpSubject?.description) {
          const val: string = xmpSubject.description;
          exif.keywords = val.includes(',')
            ? val.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [val];
        }
      } else if (iptcKeywords) {
        if (Array.isArray(iptcKeywords)) {
          exif.keywords = iptcKeywords
            .map((k: unknown) =>
              typeof k === 'string'
                ? k
                : (k as { description?: string })?.description || String(k)
            )
            .filter(Boolean);
        } else if (typeof iptcKeywords === 'object' && iptcKeywords?.description) {
          const val: string = iptcKeywords.description;
          exif.keywords = val.includes(',')
            ? val.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [val];
        }
      } else if (exifKeywords && typeof exifKeywords === 'string') {
        exif.keywords = exifKeywords
          .split(/[;,]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      const gps = tags.gps;
      if (gps?.Latitude !== undefined && gps?.Longitude !== undefined) {
        exif.latitude = gps.Latitude;
        exif.longitude = gps.Longitude;
      }
    } catch {
      // EXIF extraction is best-effort
    }
    return exif;
  }

  private async addFiles(newFiles: File[]): Promise<void> {
    const existing = this.files();
    const existingNames = new Set(existing.map((f) => f.name));

    const filtered = newFiles.filter((f) => !existingNames.has(f.name));
    const previews: FilePreview[] = [];

    for (const file of filtered) {
      const exif = await this.extractExif(file);
      previews.push({
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: this.formatFileSize(file.size),
        exif,
      });
    }

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
    const country = this.showCountrySelect
      ? this.selectedCountry() || undefined
      : undefined;

    this.photosService.uploadPhotos(rawFiles, country).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.uploadProgress.set(100);
        const count = res.images?.length || rawFiles.length;
        this.snackBar.open(
          `${count} photo${count > 1 ? 's' : ''} uploaded successfully`,
          'Close',
          { duration: 4000 }
        );
        fileList.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        // Resolve country_id from selected country name
        const selectedName = this.selectedCountry();
        const matchedCountry = this.countries().find((c) => c.name === selectedName);
        this.dialogRef.close({
          uploaded: true,
          count,
          country_id: matchedCountry?.id ?? null,
          images: res.images?.map((img) => ({
            public_id: img.public_id,
            secure_url: img.secure_url,
            url: img.url,
            exif: img.exif,
          })),
        });
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

