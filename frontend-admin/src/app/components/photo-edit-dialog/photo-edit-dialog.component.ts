import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { AdminPhoto } from '../../interfaces';
import { PhotosService } from '../../services/photos.service';
import { AuthService, UserPayload } from '@shared/services';
import { DetailsTabComponent } from './details-tab/details-tab.component';
import { EntityTabComponent } from './entity-tab/entity-tab.component';
import { LocationTabComponent, CitySelectedEvent } from './location-tab/location-tab.component';
import { InfoTabComponent } from './info-tab/info-tab.component';

export interface PhotoEditDialogData {
  photo: AdminPhoto;
}

export interface PhotoEditDialogResult {
  updated: boolean;
}

@Component({
  selector: 'app-photo-edit-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    DetailsTabComponent,
    EntityTabComponent,
    LocationTabComponent,
    InfoTabComponent,
  ],
  templateUrl: './photo-edit-dialog.component.html',
  styleUrl: './photo-edit-dialog.component.scss',
})
export class PhotoEditDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PhotoEditDialogComponent>);
  private readonly data: PhotoEditDialogData = inject(MAT_DIALOG_DATA);
  private readonly photosService = inject(PhotosService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  photo = this.data.photo;

  caption = '';
  tags: string[] = [];
  latitude: number | null = null;
  longitude: number | null = null;

  cityId: number | null = null;
  attractionId: number | null = null;

  saving = signal(false);

  private currentUser: UserPayload | null = null;

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => (this.currentUser = u));

    this.caption = this.photo.caption || '';
    this.tags = [...(this.photo.tags || [])];
    this.latitude = this.photo.latitude ?? null;
    this.longitude = this.photo.longitude ?? null;
    this.cityId = this.photo.city_id;
    this.attractionId = this.photo.attraction_id;
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
        next: () => {
          this.snackBar.open('Photo updated successfully', 'Close', { duration: 3000 });
          this.saving.set(false);
          this.dialogRef.close({ updated: true });
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to update photo', 'Close', { duration: 5000 });
          this.saving.set(false);
        },
      });
  }

  onCitySelectedFromLocation(event: CitySelectedEvent): void {
    this.cityId = event.cityId;
    this.snackBar.open(`City set to "${event.cityName}"`, 'Close', { duration: 3000 });
  }

  cancel(): void {
    this.dialogRef.close({ updated: false });
  }
}
