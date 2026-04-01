import { computed, Injectable, signal } from '@angular/core';
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

  // ── Initial snapshot (set on init, used for dirty checking) ──
  private initialCaption = '';
  private initialTags: string[] = [];
  private initialLatitude: number | null = null;
  private initialLongitude: number | null = null;
  private initialCityId: number | null = null;
  private initialAttractionId: number | null = null;
  private initialStateId: number | null = null;
  private initialCountryId: number | null = null;

  readonly hasChanges = computed(
    () =>
      this.caption() !== this.initialCaption ||
      JSON.stringify([...this.tags()].sort()) !== JSON.stringify([...this.initialTags].sort()) ||
      this.latitude() !== this.initialLatitude ||
      this.longitude() !== this.initialLongitude ||
      this.cityId() !== this.initialCityId ||
      this.attractionId() !== this.initialAttractionId ||
      this.stateId() !== this.initialStateId ||
      this.countryId() !== this.initialCountryId
  );

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

    // Store initial snapshot for dirty checking
    this.initialCaption = photo.caption || '';
    this.initialTags = [...(photo.tags || [])];
    this.initialLatitude = photo.latitude ?? null;
    this.initialLongitude = photo.longitude ?? null;
    this.initialCityId = photo.city_id ?? null;
    this.initialAttractionId = photo.attraction_id ?? null;
    this.initialStateId = photo.state_id ?? null;
    this.initialCountryId = photo.country_id ?? null;
  }
}
