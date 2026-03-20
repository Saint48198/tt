import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PhotoEditStateService } from '../photo-edit-state.service';

@Component({
  selector: 'app-details-tab',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './details-tab.component.html',
  styleUrl: './details-tab.component.scss',
})
export class DetailsTabComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly state = inject(PhotoEditStateService);

  tagsInput = '';

  // Suggest caption state
  suggestedCaptions = signal<string[]>([]);
  suggestingCaption = signal(false);
  suggestCaptionError = signal<string | null>(null);

  // Suggest tags state
  suggestedTags = signal<string[]>([]);
  suggestingTags = signal(false);
  suggestError = signal<string | null>(null);

  suggestCaption(): void {
    const url = this.state.photo().url;
    if (!url) return;

    this.suggestingCaption.set(true);
    this.suggestCaptionError.set(null);
    this.suggestedCaptions.set([]);

    const hints: Record<string, unknown> = {};
    const tags = this.state.tags();
    if (tags.length) hints['tags'] = tags;

    this.http
      .post<{ suggestions: string[] }>('/api/photos/suggest-titles', { imageUrl: url, hints })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.suggestedCaptions.set(res.suggestions || []);
          this.suggestingCaption.set(false);
        },
        error: (err) => {
          const msg = err?.error?.error || err?.message || 'Failed to suggest captions';
          this.suggestCaptionError.set(msg);
          this.suggestingCaption.set(false);
        },
      });
  }

  applySuggestedCaption(caption: string): void {
    this.state.caption.set(caption);
    this.suggestedCaptions.set([]);
  }

  suggestTags(): void {
    const url = this.state.photo().url;
    if (!url) return;

    this.suggestingTags.set(true);
    this.suggestError.set(null);
    this.suggestedTags.set([]);

    this.http
      .post<{ tags: string[] }>('/api/tags/suggest', { imageUrl: url })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const current = this.state.tags();
          const filtered = (res.tags || []).filter((t) => !current.includes(t));
          this.suggestedTags.set(filtered);
          this.suggestingTags.set(false);
        },
        error: (err) => {
          const msg = err?.error?.error || err?.message || 'Failed to suggest tags';
          this.suggestError.set(msg);
          this.suggestingTags.set(false);
        },
      });
  }

  addSuggestedTag(tag: string): void {
    const current = this.state.tags();
    if (!current.includes(tag)) {
      this.state.tags.set([...current, tag]);
    }
    this.suggestedTags.update((list) => list.filter((t) => t !== tag));
  }

  addTag(): void {
    const parts = this.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const current = this.state.tags();
    const updated = [...current];
    for (const tag of parts) {
      if (!updated.includes(tag)) {
        updated.push(tag);
      }
    }
    this.state.tags.set(updated);
    this.tagsInput = '';
  }

  removeTag(tag: string): void {
    this.state.tags.set(this.state.tags().filter((t) => t !== tag));
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }
}
