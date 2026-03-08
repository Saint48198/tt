import {
  Component,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapComponent, MapMarker, ImageLoaderComponent, PhotoGridComponent } from '@shared/components';
import { ExploreDetailService } from '../../../services/explore.service';

@Component({
  selector: 'app-entity-detail',
  imports: [MapComponent, ImageLoaderComponent, RouterLink, PhotoGridComponent],
  templateUrl: './entity-detail.component.html',
  styleUrl: './entity-detail.component.scss',
})
export class EntityDetailComponent {
  readonly detail = inject(ExploreDetailService);

  /** Link to the photo-map page, e.g. '/user/explore/photo-map' */
  photoMapLink = input.required<string>();

  // --- Computed map data ---

  get mapMarkers(): MapMarker[] {
    const e = this.detail.entity();
    if (!e) return [];
    return [{ lat: e.lat, lng: e.lng, title: e.name, popup: `<strong>${e.name}</strong>` }];
  }

  get mapCenter(): [number, number] {
    const e = this.detail.entity();
    return e ? [e.lat, e.lng] : [0, 0];
  }

  get idPrefix(): string {
    return this.detail.entityType() === 'city' ? 'city' : 'attr';
  }

  // --- Helpers ---

  toSlug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onPhotoPageChange(page: number): void {
    this.detail.fetchPhotosPage(page);
  }
}
