import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminPhoto } from '../../interfaces';
import { PhotosService } from '../../services/photos.service';
import { CitiesService } from '../../services/cities.service';
import { AttractionsService } from '../../services/attractions.service';
import { AuthService, UserPayload } from '@shared/services';
import { MapComponent, MapMarker } from '@shared/components';

export interface PhotoEditDialogData {
  photo: AdminPhoto;
}

export interface PhotoEditDialogResult {
  updated: boolean;
}

interface EntityOption {
  id: number;
  name: string;
}

@Component({
  selector: 'app-photo-edit-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTabsModule,
    MatTooltipModule,
    MapComponent,
  ],
  templateUrl: './photo-edit-dialog.component.html',
  styleUrl: './photo-edit-dialog.component.scss',
})
export class PhotoEditDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PhotoEditDialogComponent>);
  private readonly data: PhotoEditDialogData = inject(MAT_DIALOG_DATA);
  private readonly photosService = inject(PhotosService);
  private readonly citiesService = inject(CitiesService);
  private readonly attractionsService = inject(AttractionsService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  photo = this.data.photo;

  caption = '';
  tagsInput = '';
  tags: string[] = [];
  latitude: number | null = null;
  longitude: number | null = null;

  hasLocation = computed(() => this.latitude != null && this.longitude != null);
  mapMarkers = computed<MapMarker[]>(() => {
    if (this.latitude != null && this.longitude != null) {
      return [{ lat: this.latitude, lng: this.longitude, title: this.caption || 'Photo location', popup: `<b>${this.caption || 'Photo'}</b><br/>Lat: ${this.latitude.toFixed(5)}, Lng: ${this.longitude.toFixed(5)}` }];
    }
    return [];
  });
  mapCenter = computed<[number, number]>(() => {
    if (this.latitude != null && this.longitude != null) {
      return [this.latitude, this.longitude];
    }
    return [39.8283, -98.5795];
  });

  // City combobox
  cityId: number | null = null;
  cityInputValue = signal('');
  private allCities = signal<EntityOption[]>([]);
  loadingCities = signal(false);
  filteredCities = computed(() => {
    const q = this.cityInputValue().toLowerCase();
    const all = this.allCities();
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  // Attraction combobox
  attractionId: number | null = null;
  attractionInputValue = signal('');
  private allAttractions = signal<EntityOption[]>([]);
  loadingAttractions = signal(false);
  filteredAttractions = computed(() => {
    const q = this.attractionInputValue().toLowerCase();
    const all = this.allAttractions();
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all;
  });

  saving = signal(false);

  private currentUser: UserPayload | null = null;

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((u) => (this.currentUser = u));

    this.caption = this.photo.caption || '';
    this.tags = [...(this.photo.tags || [])];
    this.latitude = this.photo.latitude ?? null;
    this.longitude = this.photo.longitude ?? null;
    this.cityId = this.photo.city_id;
    this.cityInputValue.set(this.photo.city_name || '');
    this.attractionId = this.photo.attraction_id;
    this.attractionInputValue.set(this.photo.attraction_name || '');

    this.loadCities();
    this.loadAttractions();
  }

  private loadCities(): void {
    this.loadingCities.set(true);
    const countryId = this.photo.country_id;
    const params = countryId
      ? { country_id: countryId, page: 1, limit: 500 }
      : { page: 1, limit: 500 };
    this.citiesService.getCities(params).subscribe({
      next: (res) => {
        this.allCities.set(res.cities.map((c) => ({ id: c.id, name: c.name })));
        this.loadingCities.set(false);
      },
      error: () => {
        this.allCities.set([]);
        this.loadingCities.set(false);
      },
    });
  }

  private loadAttractions(): void {
    this.loadingAttractions.set(true);
    const countryId = this.photo.country_id;
    const params = countryId
      ? { country_id: countryId, page: 1, limit: 500 }
      : { page: 1, limit: 500 };
    this.attractionsService.getAttractions(params).subscribe({
      next: (res) => {
        this.allAttractions.set(res.attractions.map((a) => ({ id: a.id, name: a.name })));
        this.loadingAttractions.set(false);
      },
      error: () => {
        this.allAttractions.set([]);
        this.loadingAttractions.set(false);
      },
    });
  }

  // ── City combobox ──

  onCityInput(value: string): void {
    this.cityInputValue.set(value);
    if (!value) {
      this.cityId = null;
    }
  }

  onCitySelected(option: EntityOption): void {
    this.cityId = option.id;
    this.cityInputValue.set(option.name);
  }

  clearCity(): void {
    this.cityId = null;
    this.cityInputValue.set('');
  }

  displayCityFn = (option: EntityOption): string => option?.name ?? '';

  // ── Attraction combobox ──

  onAttractionInput(value: string): void {
    this.attractionInputValue.set(value);
    if (!value) {
      this.attractionId = null;
    }
  }

  onAttractionSelected(option: EntityOption): void {
    this.attractionId = option.id;
    this.attractionInputValue.set(option.name);
  }

  clearAttraction(): void {
    this.attractionId = null;
    this.attractionInputValue.set('');
  }

  displayAttractionFn = (option: EntityOption): string => option?.name ?? '';

  // ── Tags ──

  addTag(): void {
    const parts = this.tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    for (const tag of parts) {
      if (!this.tags.includes(tag)) {
        this.tags.push(tag);
      }
    }
    this.tagsInput = '';
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  // ── Save ──

  save(): void {
    if (!this.photo.in_database || this.photo.id == null) {
      // Photo only in Cloudinary — needs at least one entity to add to DB
      if (!this.cityId && !this.attractionId) {
        this.snackBar.open('Select at least a city or attraction to add this photo to the database', 'Close', {
          duration: 5000,
        });
        return;
      }

      this.saving.set(true);
      this.photosService
        .addPhotoToDb({
          photo_id: this.photo.photo_id,
          url: this.photo.url,
          caption: this.caption || null,
          city_id: this.cityId,
          attraction_id: this.attractionId,
          user_id: this.currentUser?.id,
          latitude: this.latitude,
          longitude: this.longitude,
          tags: this.tags,
        })
        .subscribe({
          next: () => {
            this.snackBar.open('Photo added to database', 'Close', { duration: 3000 });
            this.saving.set(false);
            this.dialogRef.close({ updated: true });
          },
          error: (err) => {
            this.snackBar.open(err?.error?.error || 'Failed to save', 'Close', { duration: 5000 });
            this.saving.set(false);
          },
        });
      return;
    }

    // Photo exists in DB — update
    this.saving.set(true);
    this.photosService
      .updatePhoto(this.photo.id, {
        caption: this.caption || null,
        tags: this.tags,
        city_id: this.cityId,
        attraction_id: this.attractionId,
        latitude: this.latitude,
        longitude: this.longitude,
      })
      .subscribe({
        next: (res) => {
          if (res.deleted) {
            this.snackBar.open('Photo removed from database (no entity links)', 'Close', { duration: 4000 });
          } else {
            this.snackBar.open('Photo updated successfully', 'Close', { duration: 3000 });
          }
          this.saving.set(false);
          this.dialogRef.close({ updated: true });
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to update photo', 'Close', { duration: 5000 });
          this.saving.set(false);
        },
      });
  }

  cancel(): void {
    this.dialogRef.close({ updated: false });
  }
}
