import { Component, input, output } from '@angular/core';

export interface EntityListItem {
  id: number;
  name: string;
  badge?: string;
  subtitle?: string;
  lastVisited?: string;
  icon: 'pin' | 'capitol' | 'skyline' | 'unesco' | 'tree' | 'park' | 'castle';
  tags?: { id: number; name: string; slug: string }[];
}

@Component({
  selector: 'app-entity-list',
  templateUrl: './entity-list.component.html',
  styleUrl: './entity-list.component.scss',
})
export class EntityListComponent {
  /** The items to display in the card grid */
  items = input.required<EntityListItem[]>();

  /** Empty state message when no items are found */
  emptyMessage = input<string>('No items found.');

  /** Whether to show the photo button on each card */
  showPhotoButton = input<boolean>(true);

  /** Emitted when a card is clicked */
  cardClick = output<EntityListItem>();

  /** Emitted when the photo button is clicked, with the item */
  photoClick = output<EntityListItem>();

  onCardClick(item: EntityListItem): void {
    this.cardClick.emit(item);
  }

  onPhotoClick(item: EntityListItem, event: Event): void {
    event.stopPropagation();
    this.photoClick.emit(item);
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }
}
