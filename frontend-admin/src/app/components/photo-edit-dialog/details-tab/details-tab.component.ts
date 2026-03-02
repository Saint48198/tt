import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  ],
  templateUrl: './details-tab.component.html',
  styleUrl: './details-tab.component.scss',
})
export class DetailsTabComponent {
  caption = model.required<string>();
  tags = model.required<string[]>();

  tagsInput = '';

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


