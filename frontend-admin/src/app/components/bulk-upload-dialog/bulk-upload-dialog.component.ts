import { Component, DestroyRef, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
import { lastValueFrom, firstValueFrom, finalize } from 'rxjs';
import { PhotosService } from '../../services/photos.service';
import { CountriesService } from '../../services/countries.service';
import { GeocodeService } from '../../services/geocode.service';
import type { Country } from '@shared/types';
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
  /** Country name from IPTC metadata (if available) */
  iptcCountry?: string;
}

interface FilePreview {
  file: File;
  previewUrl: string;
  name: string;
  size: string;
  exif?: ExifData;
  /** Upload/processing status for this file */
  status?: 'pending' | 'reading' | 'resizing' | 'ready' | 'uploading' | 'done' | 'error';
  /** Error message if status is 'error' */
  errorMessage?: string;
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

  // Processing stage tracking
  /** Current processing stage: 'idle' | 'reading' | 'uploading' | 'done' */
  processingStage = signal<'idle' | 'reading' | 'uploading' | 'done'>('idle');
  /** How many files have finished processing (EXIF + resize) */
  filesProcessed = signal(0);
  /** Total files being processed */
  filesToProcess = signal(0);
  /** How many files uploaded so far (for upload stage counter) */
  filesUploaded = signal(0);

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
      this.countriesService
        .getAllCountries('name')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => this.countries.set(res.countries),
        });
    }
  }

  ngOnDestroy(): void {
    this.files().forEach((f) => URL.revokeObjectURL(f.previewUrl));
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      input.value = '';
      await this.addFiles(files);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    if (event.dataTransfer?.files) {
      const imageFiles = Array.from(event.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      await this.addFiles(imageFiles);
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

  /**
   * Apply GPS direction reference to a coordinate value.
   * South latitudes and West longitudes should be negative.
   */
  private applyGpsDirection(value: number, ref: string | undefined): number {
    if (ref === 'S' || ref === 'South' || ref === 'W' || ref === 'West') {
      return -Math.abs(value);
    }
    return value;
  }

  private async extractExif(file: File): Promise<ExifData> {
    const exif: ExifData = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tags: any;
    let expandedLoadFailed = false;
    try {
      const buffer = await file.arrayBuffer();
      tags = ExifReader.load(buffer, { expanded: true });
    } catch (e) {
      console.warn('[EXIF] Expanded load failed:', e);
      expandedLoadFailed = true;
    }

    // If expanded load failed entirely, try non-expanded to get what we can
    if (expandedLoadFailed) {
      try {
        const buffer = await file.arrayBuffer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawTags: any = ExifReader.load(buffer);

        // Extract GPS from non-expanded
        const rawLat = rawTags.GPSLatitude;
        const rawLng = rawTags.GPSLongitude;
        const latRef = rawTags.GPSLatitudeRef?.value?.[0] || rawTags.GPSLatitudeRef?.description;
        const lngRef = rawTags.GPSLongitudeRef?.value?.[0] || rawTags.GPSLongitudeRef?.description;

        if (rawLat?.description && rawLng?.description) {
          let lat = parseFloat(String(rawLat.description));
          let lng = parseFloat(String(rawLng.description));
          if (!isNaN(lat) && !isNaN(lng)) {
            lat = this.applyGpsDirection(lat, latRef);
            lng = this.applyGpsDirection(lng, lngRef);
            exif.latitude = lat;
            exif.longitude = lng;
          }
        }

        const dateTag = rawTags.DateTimeOriginal;
        if (dateTag?.description) {
          const isoDate = dateTag.description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
          const parsed = new Date(isoDate + 'Z');
          if (!isNaN(parsed.getTime())) {
            exif.created_date = parsed.toISOString();
          }
        }

        // Extract title from non-expanded
        const titleTag = rawTags.ImageDescription || rawTags.XPTitle;
        if (titleTag?.description) {
          exif.title = titleTag.description;
        }

        // Extract keywords from non-expanded
        const kwTag = rawTags.XPKeywords;
        if (kwTag?.description && typeof kwTag.description === 'string') {
          exif.keywords = kwTag.description
            .split(/[;,]/)
            .map((s: string) => s.trim())
            .filter(Boolean);
        }

        return exif;
      } catch (e2) {
        console.warn('[EXIF] Non-expanded load also failed:', e2);
        return exif;
      }
    }

    // Extract title
    try {
      const xmpTitle = tags.xmp?.['dc:title']?.description || tags.xmp?.['title']?.description;
      const iptcTitle = tags.iptc?.['Object Name']?.description;
      const exifTitle =
        tags.exif?.['ImageDescription']?.description || tags.exif?.['XPTitle']?.description;
      exif.title = xmpTitle || iptcTitle || exifTitle || undefined;
    } catch {
      // title extraction failed
    }

    // Extract keywords
    try {
      const xmpSubject = tags.xmp?.['dc:subject'] || tags.xmp?.['subject'];
      const iptcKeywords = tags.iptc?.['Keywords'];
      const exifKeywords = tags.exif?.['XPKeywords']?.description;

      if (xmpSubject) {
        if (Array.isArray(xmpSubject)) {
          exif.keywords = xmpSubject
            .map((k: unknown) =>
              typeof k === 'string' ? k : (k as { description?: string })?.description || String(k)
            )
            .filter(Boolean);
        } else if (typeof xmpSubject === 'object' && xmpSubject?.description) {
          const val: string = xmpSubject.description;
          exif.keywords = val.includes(',')
            ? val
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [val];
        }
      } else if (iptcKeywords) {
        if (Array.isArray(iptcKeywords)) {
          exif.keywords = iptcKeywords
            .map((k: unknown) =>
              typeof k === 'string' ? k : (k as { description?: string })?.description || String(k)
            )
            .filter(Boolean);
        } else if (typeof iptcKeywords === 'object' && iptcKeywords?.description) {
          const val: string = iptcKeywords.description;
          exif.keywords = val.includes(',')
            ? val
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [val];
        }
      } else if (exifKeywords && typeof exifKeywords === 'string') {
        exif.keywords = exifKeywords
          .split(/[;,]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    } catch {
      // keywords extraction failed
    }

    // Extract IPTC country name (more reliable than GPS reverse-geocode for country detection)
    try {
      const iptcCountry =
        tags.iptc?.['Country-Primary Location Name']?.description ||
        tags.iptc?.['Country/Primary Location Name']?.description;
      if (iptcCountry && typeof iptcCountry === 'string' && iptcCountry.trim()) {
        exif.iptcCountry = iptcCountry.trim();
      }
    } catch {
      // IPTC country extraction failed
    }

    // Extract GPS coordinates
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    // For PNG files, ExifReader expanded mode (tags.gps) returns unsigned lat/lng
    // (no negative sign for W/S). Use non-expanded mode instead, which keeps the
    // direction letter in the description (e.g. "46,48.159N" / "89,45.944W").
    if (isPng) {
      try {
        const buf2 = await file.arrayBuffer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any = ExifReader.load(buf2);
        const rawLat = raw.GPSLatitude;
        const rawLng = raw.GPSLongitude;
        const latRefVal = raw.GPSLatitudeRef?.description || raw.GPSLatitudeRef?.value?.[0];
        const lngRefVal = raw.GPSLongitudeRef?.description || raw.GPSLongitudeRef?.value?.[0];

        if (rawLat?.description && rawLng?.description) {
          // description may be a decimal string like "46.802654" or DMS like "46,48.159N"
          let lat: number;
          let lng: number;
          const parseDmsOrDecimal = (s: string): { value: number; dir?: string } => {
            // Try DMS with direction: "46,48.159N" or "89,45,56.6W"
            const m = s.match(/^([\d.]+),([\d.]+)(?:,([\d.]+))?([NSEW])$/i);
            if (m) {
              const deg = parseFloat(m[1]);
              const min = parseFloat(m[2]);
              const sec = m[3] ? parseFloat(m[3]) : 0;
              const dir = m[4].toUpperCase();
              let val = deg + min / 60 + sec / 3600;
              if (dir === 'S' || dir === 'W') val = -val;
              return { value: val, dir };
            }
            // Try decimal with direction: "46.802654N" or "89.765732W"
            const m2 = s.match(/^([\d.]+)([NSEW])$/i);
            if (m2) {
              const dir = m2[2].toUpperCase();
              let val = parseFloat(m2[1]);
              if (dir === 'S' || dir === 'W') val = -val;
              return { value: val, dir };
            }
            return { value: parseFloat(s) };
          };

          const latParsed = parseDmsOrDecimal(rawLat.description);
          const lngParsed = parseDmsOrDecimal(rawLng.description);
          lat = latParsed.value;
          lng = lngParsed.value;

          // If description was plain decimal, apply ref direction
          if (!latParsed.dir && (latRefVal === 'S' || latRefVal === 'South')) {
            lat = -Math.abs(lat);
          }
          if (!lngParsed.dir && (lngRefVal === 'W' || lngRefVal === 'West')) {
            lng = -Math.abs(lng);
          }

          if (!isNaN(lat) && !isNaN(lng)) {
            exif.latitude = lat;
            exif.longitude = lng;
          }
        }
      } catch (e) {
        console.warn('[EXIF GPS] PNG extraction error:', e);
      }
    }

    // For non-PNG files (or if PNG extraction above didn't find GPS)
    if (exif.latitude == null || exif.longitude == null) {
      try {
        const gps = tags.gps;
        const latRef =
          tags.exif?.GPSLatitudeRef?.value?.[0] || tags.exif?.GPSLatitudeRef?.description;
        const lngRef =
          tags.exif?.GPSLongitudeRef?.value?.[0] || tags.exif?.GPSLongitudeRef?.description;

        if (gps?.Latitude !== undefined && gps?.Longitude !== undefined) {
          let lat = gps.Latitude;
          let lng = gps.Longitude;
          lat = this.applyGpsDirection(lat, latRef);
          lng = this.applyGpsDirection(lng, lngRef);
          exif.latitude = lat;
          exif.longitude = lng;
        } else {
          const rawLat = tags.exif?.GPSLatitude;
          const rawLng = tags.exif?.GPSLongitude;
          if (rawLat?.description && rawLng?.description) {
            let lat = parseFloat(rawLat.description);
            let lng = parseFloat(rawLng.description);
            if (!isNaN(lat) && !isNaN(lng)) {
              lat = this.applyGpsDirection(lat, latRef);
              lng = this.applyGpsDirection(lng, lngRef);
              exif.latitude = lat;
              exif.longitude = lng;
            }
          }
        }
      } catch (e) {
        console.warn('[EXIF GPS] extraction error:', e);
      }
    }

    // Extract original date taken from DateTimeOriginal or XMP date fields
    try {
      const dateOriginal: string | undefined = tags.exif?.DateTimeOriginal?.description;
      if (dateOriginal) {
        const isoDate = dateOriginal.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const parsed = new Date(isoDate + 'Z');
        if (!isNaN(parsed.getTime())) {
          exif.created_date = parsed.toISOString();
        }
      }

      // Fallback: check XMP date fields (common in PNGs)
      if (!exif.created_date && tags.xmp) {
        const xmpDateKey = [
          'DateCreated',
          'CreateDate',
          'xmp:CreateDate',
          'photoshop:DateCreated',
          'DateTimeOriginal',
          'exif:DateTimeOriginal',
        ].find((k) => tags.xmp?.[k]?.description);
        if (xmpDateKey) {
          const xmpDate = tags.xmp[xmpDateKey].description;
          const isoDate = xmpDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
          const parsed = new Date(isoDate);
          if (!isNaN(parsed.getTime())) {
            exif.created_date = parsed.toISOString();
          }
        }
      }

      // Fallback for PNGs: try non-expanded mode DateTimeOriginal or DateCreated
      if (!exif.created_date && isPng) {
        try {
          const buf = await file.arrayBuffer();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw: any = ExifReader.load(buf);
          const dateTag =
            raw.DateTimeOriginal || raw.DateCreated || raw.CreateDate || raw['xmp:CreateDate'];
          if (dateTag?.description) {
            const isoDate = dateTag.description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
            const parsed = new Date(isoDate);
            if (!isNaN(parsed.getTime())) {
              exif.created_date = parsed.toISOString();
            }
          }
        } catch {
          // PNG date fallback failed
        }
      }
    } catch {
      // date extraction failed
    }

    return exif;
  }

  private readonly MAX_FILE_SIZE = 500 * 1024; // 500KB
  private readonly MAX_DIMENSION = 2000; // max width or height in pixels

  private async addFiles(newFiles: File[]): Promise<void> {
    const existing = this.files();
    const existingNames = new Set(existing.map((f) => f.name));

    const filtered = newFiles.filter((f) => !existingNames.has(f.name));
    if (filtered.length === 0) return;

    // Add placeholder entries immediately so users see their files
    const placeholders: FilePreview[] = filtered.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      size: this.formatFileSize(file.size),
      status: 'reading' as const,
    }));

    const allFiles = [...existing, ...placeholders];
    this.files.set(allFiles);

    // Track processing progress
    const isLargeBatch = filtered.length >= 5;
    if (isLargeBatch) {
      this.processingStage.set('reading');
      this.filesProcessed.set(0);
      this.filesToProcess.set(filtered.length);
    }

    // Process each file (EXIF + resize) and update status
    for (let i = 0; i < filtered.length; i++) {
      const file = filtered[i];
      const fileIndex = existing.length + i;

      try {
        // Read EXIF
        this.updateFileStatus(fileIndex, 'reading');
        const exif = await this.extractExif(file);

        // Resize if needed
        let resized = file;
        if (file.size > this.MAX_FILE_SIZE && file.type.startsWith('image/')) {
          this.updateFileStatus(fileIndex, 'resizing');
          resized = await this.resizeImage(file);
        }

        // Update the file entry with processed data
        this.files.update((files) =>
          files.map((f, idx) =>
            idx === fileIndex
              ? {
                  ...f,
                  file: resized,
                  size: this.formatFileSize(resized.size),
                  exif,
                  status: 'ready' as const,
                }
              : f
          )
        );
      } catch {
        this.updateFileStatus(fileIndex, 'error', 'Failed to process file');
      }

      if (isLargeBatch) {
        this.filesProcessed.set(i + 1);
      }
    }

    if (isLargeBatch) {
      this.processingStage.set('idle');
    }

    // Detect country from GPS data when country select is shown
    const currentFiles = this.files();
    if (this.showCountrySelect && currentFiles.length > 0) {
      await this.detectCountryFromFiles(currentFiles);
    }
  }

  /**
   * Update the status of a specific file by index.
   */
  private updateFileStatus(
    index: number,
    status: FilePreview['status'],
    errorMessage?: string
  ): void {
    this.files.update((files) =>
      files.map((f, i) => (i === index ? { ...f, status, errorMessage } : f))
    );
  }

  /**
   * Detect the country from photo metadata.
   * Prefers IPTC country name (embedded in photo metadata) over GPS reverse-geocoding.
   * Auto-selects if all photos are from the same country, and it's in the list.
   * Shows warnings for mismatches or missing countries.
   */
  private async detectCountryFromFiles(allFiles: FilePreview[]): Promise<void> {
    // First try IPTC country metadata (most reliable, no network call needed)
    const iptcCountries = new Set<string>();
    for (const file of allFiles) {
      if (file.exif?.iptcCountry) {
        iptcCountries.add(file.exif.iptcCountry);
      }
    }

    // Only check GPS for files that have GPS data
    const filesWithGps = allFiles.filter(
      (f) => f.exif?.latitude != null && f.exif?.longitude != null
    );

    if (filesWithGps.length === 0 && iptcCountries.size === 0) {
      return;
    }

    this.detectingCountry.set(true);
    this.countryMismatchWarning.set('');
    this.countryNotFoundWarning.set('');
    this.detectedCountryName.set('');

    try {
      // If we have IPTC country data, use it (no network calls needed)
      const countryNames = new Set<string>(iptcCountries);

      if (filesWithGps.length > 0 && iptcCountries.size === 0) {
        // Only do reverse geocoding if we don't already have IPTC country data
        const seen = new Set<string>();

        for (const file of filesWithGps) {
          const lat = file.exif?.latitude;
          const lng = file.exif?.longitude;
          if (lat == null || lng == null) continue;

          const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          try {
            const result = await lastValueFrom(this.geocodeService.reverseGeocode(lat, lng));
            if (result?.country) {
              countryNames.add(result.country);
            }
          } catch {
            // Skip files that fail geocoding
          }
        }
      }

      if (countryNames.size === 0) {
        return;
      }

      // Ensure countries list is loaded before matching
      if (this.countries().length === 0) {
        try {
          const res = await firstValueFrom(this.countriesService.getAllCountries('name'));
          this.countries.set(res.countries);
        } catch {
          // Countries load failed
        }
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
      const matchedCountry = this.matchCountryName(detectedCountry);

      if (matchedCountry) {
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
   * Match a detected country name (from Nominatim or IPTC) to a country in the DB list.
   * Uses the country's aliases from the database (country_aliases table).
   * Tries exact match on name, then abbreviation, then DB aliases.
   */
  private matchCountryName(detectedName: string): Country | undefined {
    const countries = this.countries();
    const detected = detectedName.toLowerCase().trim();

    // 1. Exact match on name
    const exact = countries.find((c) => c.name.toLowerCase().trim() === detected);
    if (exact) return exact;

    // 2. Match on abbreviation (e.g. "US", "UK")
    const abbrMatch = countries.find(
      (c) => c.abbreviation && c.abbreviation.toLowerCase().trim() === detected
    );
    if (abbrMatch) return abbrMatch;

    // 3. Check DB aliases (from country_aliases table)
    for (const country of countries) {
      if (country.aliases?.length) {
        const aliasMatch = country.aliases.some((a) => a.alias.toLowerCase().trim() === detected);
        if (aliasMatch) return country;
      }
    }

    // 4. Word-boundary-aware matching: only match if one name is a complete
    //    word-boundary prefix/suffix of the other (avoids "Niger" → "Nigeria")
    const detectedWords = detected.split(/\s+/);
    for (const country of countries) {
      const countryLower = country.name.toLowerCase().trim();
      const countryWords = countryLower.split(/\s+/);

      if (detectedWords.length >= 2 || countryWords.length >= 2) {
        const shorter = detectedWords.length <= countryWords.length ? detectedWords : countryWords;
        const longer = detectedWords.length <= countryWords.length ? countryWords : detectedWords;
        const allMatch = shorter.every((w, i) => longer[i] === w);
        if (allMatch && shorter.length >= 2) {
          return country;
        }
      }
    }

    return undefined;
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

              if (
                blob.size > this.MAX_FILE_SIZE &&
                quality > minQuality &&
                mimeType !== 'image/png'
              ) {
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
            mimeType === 'image/png' ? undefined : quality
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
    this.processingStage.set('idle');
    this.filesProcessed.set(0);
    this.filesToProcess.set(0);
    this.filesUploaded.set(0);
  }

  upload(): void {
    const fileList = this.files();
    if (fileList.length === 0) return;

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.processingStage.set('uploading');
    this.filesUploaded.set(0);

    // Mark all ready files as uploading
    this.files.update((files) =>
      files.map((f) =>
        f.status === 'ready' || !f.status ? { ...f, status: 'uploading' as const } : f
      )
    );

    const rawFiles = fileList.map((f) => f.file);
    const exifData = fileList.map((f) => f.exif || {});
    const country = this.showCountrySelect ? this.selectedCountry() || undefined : undefined;

    this.photosService
      .uploadPhotos(rawFiles, country, exifData)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.uploading.set(false))
      )
      .subscribe({
        next: (res) => {
          this.uploadProgress.set(100);
          this.processingStage.set('done');

          // Mark all files as done
          this.files.update((files) => files.map((f) => ({ ...f, status: 'done' as const })));
          this.filesUploaded.set(fileList.length);

          const count = res.images?.length || rawFiles.length;
          this.snackBar.open(
            `${count} photo${count > 1 ? 's' : ''} uploaded successfully`,
            'Close',
            { duration: 4000 }
          );
          fileList.forEach((f) => URL.revokeObjectURL(f.previewUrl));
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
                original_filename:
                  fileList[idx]?.name || (img['original_filename'] as string) || undefined,
                exif: {
                  title: serverExif.title || clientExif.title || undefined,
                  keywords: serverExif.keywords?.length
                    ? serverExif.keywords
                    : clientExif.keywords || undefined,
                  latitude: serverExif.latitude ?? clientExif.latitude ?? undefined,
                  longitude: serverExif.longitude ?? clientExif.longitude ?? undefined,
                  created_date:
                    serverExif.created_date ||
                    (img['created_date'] as string) ||
                    clientExif.created_date ||
                    undefined,
                },
              };
            }),
          });
        },
        error: (err) => {
          this.processingStage.set('idle');
          const errorMessage = err?.error?.error || err?.message || 'Upload failed';
          // Mark uploading files as error
          this.files.update((files) =>
            files.map((f) =>
              f.status === 'uploading' ? { ...f, status: 'error' as const, errorMessage } : f
            )
          );
          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
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
