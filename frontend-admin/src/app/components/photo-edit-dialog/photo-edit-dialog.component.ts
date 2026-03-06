import { Component, DestroyRef, inject, OnInit } from '@angular/core';
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
import { LocationTabComponent } from './location-tab/location-tab.component';
import { InfoTabComponent } from './info-tab/info-tab.component';
import { ImageLoaderComponent } from '@shared/components';
import { PhotoEditStateService } from './photo-edit-state.service';

export interface PhotoEditDialogData {
  photo: AdminPhoto;
}

export interface PhotoEditDialogResult {
  updated: boolean;
}

@Component({
  selector: 'app-photo-edit-dialog',
  providers: [PhotoEditStateService],
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
    ImageLoaderComponent,
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
  readonly state = inject(PhotoEditStateService);

  private currentUser: UserPayload | null = null;

  get photo(): AdminPhoto {
    return this.state.photo();
  }

  ngOnInit(): void {
    this.state.init(this.data.photo);

    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => (this.currentUser = u));
  }

  // ── Save ──
  save(): void {
    const photo = this.state.photo();
    const caption = this.state.caption();
    const tags = this.state.tags();
    const latitude = this.state.latitude();
    const longitude = this.state.longitude();
    const cityId = this.state.cityId();
    const attractionId = this.state.attractionId();
    const stateId = this.state.stateId();

    if (!photo.in_database || photo.id == null) {
      // Photo only in Cloudinary — needs at least one entity to add to DB
      if (!cityId && !attractionId) {
        this.snackBar.open('Select at least a city or attraction to add this photo to the database', 'Close', {
          duration: 5000,
        });
        return;
      }

      this.state.saving.set(true);
      this.photosService
        .addPhotoToDb({
          photo_id: photo.photo_id,
          url: photo.url,
          caption: caption || null,
          city_id: cityId,
          attraction_id: attractionId,
          state_id: stateId,
          user_id: this.currentUser?.id,
          latitude,
          longitude,
          tags,
        })
        .subscribe({
          next: () => {
            this.snackBar.open('Photo added to database', 'Close', { duration: 3000 });
            this.state.saving.set(false);
            this.dialogRef.close({ updated: true });
          },
          error: (err) => {
            this.snackBar.open(err?.error?.error || 'Failed to save', 'Close', { duration: 5000 });
            this.state.saving.set(false);
          },
        });
      return;
    }

    // Photo exists in DB — update
    this.state.saving.set(true);
    this.photosService
      .updatePhoto(photo.id, {
        caption: caption || null,
        tags,
        city_id: cityId,
        attraction_id: attractionId,
        state_id: stateId,
        country_id: this.state.countryId(),
        latitude,
        longitude,
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Photo updated successfully', 'Close', { duration: 3000 });
          this.state.saving.set(false);
          this.dialogRef.close({ updated: true });
        },
        error: (err) => {
          this.snackBar.open(err?.error?.error || 'Failed to update photo', 'Close', { duration: 5000 });
          this.state.saving.set(false);
        },
      });
  }

  cancel(): void {
    this.dialogRef.close({ updated: false });
  }
}
