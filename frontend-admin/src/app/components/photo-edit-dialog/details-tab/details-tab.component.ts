import { Component, DestroyRef, inject, input, model, signal } from '@angular/core';
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

  caption = model.required<string>();
  tags = model.required<string[]>();
  photoUrl = input<string>('');

  tagsInput = '';

  // Suggest tags state
  suggestedTags = signal<string[]>([]);
  suggestingTags = signal(false);
  suggestError = signal<string | null>(null);

  suggestTags(): void {
    const url = this.photoUrl();
    if (!url) return;

    this.suggestingTags.set(true);
    this.suggestError.set(null);
    this.suggestedTags.set([]);

    this.http.post<{ tags: string[] }>('/api/tags/suggest', { imageUrl: url })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const current = this.tags();
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
    const current = this.tags();
    if (!current.includes(tag)) {
      this.tags.set([...current, tag]);
    }
    this.suggestedTags.update((list) => list.filter((t) => t !== tag));
  }


  addTag(): void {
    const parts = this.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const current = this.tags();
    const updated = [...current];
    for (const tag of parts) {
      if (!updated.includes(tag)) {
        updated.push(tag);
      }
    }
    this.tags.set(updated);
    this.tagsInput = '';
  }

  removeTag(tag: string): void {
    this.tags.set(this.tags().filter((t) => t !== tag));
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }
}


