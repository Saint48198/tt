import { Component, DestroyRef, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { RouterModule } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { PhotosService } from '../../services/photos.service';
import { CountriesService } from '../../services/countries.service';
import { GeocodeService } from '../../services/geocode.service';
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
    original_filename?: string;
    exif?: {
      title?: string;
      keywords?: string[];
      latitude?: number;
      longitude?: number;
      created_date?: string;
    };
  }>;
}

interface ExifData {
  title?: string;
  keywords?: string[];
  latitude?: number;
  longitude?: number;
  created_date?: string;
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
    RouterModule,
  ],
  templateUrl: './bulk-upload-dialog.component.html',
  styleUrl: './bulk-upload-dialog.component.scss',
})
export class BulkUploadDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<BulkUploadDialogComponent>);
  private readonly photosService = inject(PhotosService);
  private readonly countriesService = inject(CountriesService);
  private readonly geocodeService = inject(GeocodeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly data: BulkUploadDialogData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};

  files = signal<FilePreview[]>([]);
  uploading = signal(false);
  uploadProgress = signal(0);
  dragOver = signal(false);
  countries = signal<Country[]>([]);
  selectedCountry = signal<string>('');

  // Country detection from GPS
  detectingCountry = signal(false);
  /** Warning when photos are from different countries */
  countryMismatchWarning = signal<string>('');
  /** Warning when detected country is not in the countries list */
  countryNotFoundWarning = signal<string>('');
  /** The detected country name (for the "not found" warning link) */
  detectedCountryName = signal<string>('');

  get showCountrySelect(): boolean {
    return this.data.showCountrySelect === true;
  }

  ngOnInit(): void {
    if (this.showCountrySelect) {
      this.countriesService.getAllCountries('name')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => this.countries.set(res.countries),
        });
    }
  }

  ngOnDestroy(): void {
    this.files().forEach((f) => URL.revokeObjectURL(f.previewUrl));
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

      // Extract original date taken from DateTimeOriginal
      const dateOriginal: string | undefined =
        tags.exif?.DateTimeOriginal?.description;
      if (dateOriginal) {
        // Append 'Z' to treat as UTC so the date doesn't shift due to local timezone
        const isoDate = dateOriginal.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const parsed = new Date(isoDate + 'Z');
        if (!isNaN(parsed.getTime())) {
          exif.created_date = parsed.toISOString();
        }
      }
    } catch {
      // EXIF extraction is best-effort
    }
    return exif;
  }

  private readonly MAX_FILE_SIZE = 500 * 1024; // 500KB
  private readonly MAX_DIMENSION = 2000; // max width or height in pixels

  private async addFiles(newFiles: File[]): Promise<void> {
    const existing = this.files();
    const existingNames = new Set(existing.map((f) => f.name));

    const filtered = newFiles.filter((f) => !existingNames.has(f.name));
    const previews: FilePreview[] = [];

    for (const file of filtered) {
      const exif = await this.extractExif(file);
      const resized = file.size > this.MAX_FILE_SIZE && file.type.startsWith('image/')
        ? await this.resizeImage(file)
        : file;
      previews.push({
        file: resized,
        previewUrl: URL.createObjectURL(resized),
        name: file.name,
        size: this.formatFileSize(resized.size),
        exif,
      });
    }

    const allFiles = [...existing, ...previews];
    this.files.set(allFiles);

    // Detect country from GPS data when country select is shown
    if (this.showCountrySelect && allFiles.length > 0) {
      await this.detectCountryFromFiles(allFiles);
    }
  }

  /**
   * Detect the country from GPS coordinates in EXIF data.
   * Auto-selects if all photos are from the same country and it's in the list.
   * Shows warnings for mismatches or missing countries.
   */
  private async detectCountryFromFiles(allFiles: FilePreview[]): Promise<void> {
    // Only check files that have GPS data
    const filesWithGps = allFiles.filter(
      (f) => f.exif?.latitude != null && f.exif?.longitude != null
    );

    if (filesWithGps.length === 0) {
      return;
    }

    this.detectingCountry.set(true);
    this.countryMismatchWarning.set('');
    this.countryNotFoundWarning.set('');
    this.detectedCountryName.set('');

    try {
      // Reverse geocode unique coordinates (deduplicate to avoid redundant calls)
      const seen = new Set<string>();
      const countryNames = new Set<string>();

      for (const file of filesWithGps) {
        const lat = file.exif?.latitude;
        const lng = file.exif?.longitude;
        if (lat == null || lng == null) continue;

        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        try {
          const result = await lastValueFrom(
            this.geocodeService.reverseGeocode(lat, lng)
          );
          if (result?.country) {
            countryNames.add(result.country);
          }
        } catch {
          // Skip files that fail geocoding
        }
      }

      if (countryNames.size === 0) {
        return;
      }

      if (countryNames.size > 1) {
        // Multiple countries detected
        const names = Array.from(countryNames).join(', ');
        this.countryMismatchWarning.set(
          `Photos are from multiple countries: ${names}. Please select the correct country manually.`
        );
        return;
      }

      // All photos are from the same country
      const detectedCountry = Array.from(countryNames)[0];
      const matchedCountry = this.countries().find(
        (c) => c.name.toLowerCase() === detectedCountry.toLowerCase()
      );

      if (matchedCountry) {
        // Auto-select the country
        this.selectedCountry.set(matchedCountry.name);
      } else {
        // Country not in list
        this.detectedCountryName.set(detectedCountry);
        this.countryNotFoundWarning.set(
          `Detected country "${detectedCountry}" is not in your countries list.`
        );
      }
    } finally {
      this.detectingCountry.set(false);
    }
  }

  /**
   * Resize an image file to fit within MAX_DIMENSION and compress to stay under MAX_FILE_SIZE.
   * Preserves aspect ratio. Uses canvas for resizing.
   */
  private async resizeImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);

        let { width, height } = img;

        // Scale down to fit within MAX_DIMENSION
        if (width > this.MAX_DIMENSION || height > this.MAX_DIMENSION) {
          const ratio = Math.min(this.MAX_DIMENSION / width, this.MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Try progressively lower quality until under MAX_FILE_SIZE
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let quality = 0.85;
        const minQuality = 0.3;

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file); // fallback to original
                return;
              }

              if (blob.size > this.MAX_FILE_SIZE && quality > minQuality && mimeType !== 'image/png') {
                quality -= 0.1;
                tryCompress();
                return;
              }

              const resizedFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: file.lastModified,
              });
              resolve(resizedFile);
            },
            mimeType,
            mimeType === 'image/png' ? undefined : quality,
          );
        };

        tryCompress();
      };

      img.onerror = () => {
        resolve(file); // fallback to original on error
      };

      img.src = URL.createObjectURL(file);
    });
  }

  removeFile(index: number): void {
    const current = this.files();
    URL.revokeObjectURL(current[index].previewUrl);
    this.files.set(current.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.files().forEach((f) => URL.revokeObjectURL(f.previewUrl));
    this.files.set([]);
    this.countryMismatchWarning.set('');
    this.countryNotFoundWarning.set('');
    this.detectedCountryName.set('');
  }

  upload(): void {
    const fileList = this.files();
    if (fileList.length === 0) return;

    this.uploading.set(true);
    this.uploadProgress.set(0);

    const rawFiles = fileList.map((f) => f.file);
    const exifData = fileList.map((f) => f.exif || {});
    const country = this.showCountrySelect
      ? this.selectedCountry() || undefined
      : undefined;

    this.photosService.uploadPhotos(rawFiles, country, exifData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          images: res.images?.map((img, idx) => {
            const clientExif = fileList[idx]?.exif || {};
            const serverExif = img.exif || {};
            return {
              public_id: img.public_id,
              secure_url: img.secure_url,
              url: img.url,
              original_filename: fileList[idx]?.name || (img['original_filename'] as string) || undefined,
              exif: {
                title: serverExif.title || clientExif.title || undefined,
                keywords: serverExif.keywords?.length ? serverExif.keywords : clientExif.keywords || undefined,
                latitude: serverExif.latitude ?? clientExif.latitude ?? undefined,
                longitude: serverExif.longitude ?? clientExif.longitude ?? undefined,
                created_date: (img['created_date'] as string) || clientExif.created_date || undefined,
              },
            };
          }),
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

