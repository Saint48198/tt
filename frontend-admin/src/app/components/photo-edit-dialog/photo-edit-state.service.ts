import { Injectable, signal } from '@angular/core';
import { AdminPhoto } from '../../interfaces';

/**
 * Shared state service for the photo-edit-dialog and its sub-components.
 * Provided at the dialog level so each dialog instance gets its own state.
 */
@Injectable()
export class PhotoEditStateService {
  // ── Read-only photo data ──
  readonly photo = signal<AdminPhoto>(null!);

  // ── Editable fields ──
  readonly caption = signal<string>('');
  readonly tags = signal<string[]>([]);
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);
  readonly cityId = signal<number | null>(null);
  readonly attractionId = signal<number | null>(null);
  readonly stateId = signal<number | null>(null);
  readonly countryId = signal<number | null>(null);
  readonly countryName = signal<string>('');

  // ── Saving state ──
  readonly saving = signal(false);

  /**
   * Initialize the state from an AdminPhoto object.
   */
  init(photo: AdminPhoto): void {
    this.photo.set(photo);
    this.caption.set(photo.caption || '');
    this.tags.set([...(photo.tags || [])]);
    this.latitude.set(photo.latitude ?? null);
    this.longitude.set(photo.longitude ?? null);
    this.cityId.set(photo.city_id);
    this.attractionId.set(photo.attraction_id);
    this.stateId.set(photo.state_id ?? null);
    this.countryId.set(photo.country_id ?? null);
    this.countryName.set(photo.country_name || '');
  }
}
