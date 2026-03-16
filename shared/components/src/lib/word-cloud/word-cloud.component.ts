import { Component, input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WordCloudItem } from './word-cloud.types';

@Component({
  selector: 'lib-word-cloud',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
})
export class WordCloudComponent implements AfterViewInit {
  /** Array of items with text and count */
  items = input.required<WordCloudItem[]>();

  /** Color scheme: 'default', 'warm', 'cool', 'vibrant' */
  colorScheme = input<'default' | 'warm' | 'cool' | 'vibrant'>('default');

  /** Minimum font size in pixels */
  minFontSize = input(12);

  /** Maximum font size in pixels */
  maxFontSize = input(48);

  /** Randomize colors for each word */
  randomizeColors = input(false);

  @ViewChild('wordCloudContainer') wordCloudContainer!: ElementRef<HTMLDivElement>;

  wordCloudItems: Array<WordCloudItem & { size: number; color: string }> = [];

  ngAfterViewInit(): void {
    this.generateWordCloud();
  }

  private generateWordCloud(): void {
    if (!this.items() || this.items().length === 0) {
      this.wordCloudItems = [];
      return;
    }

    const items = this.items();
    const minCount = Math.min(...items.map((i) => i.count));
    const maxCount = Math.max(...items.map((i) => i.count));
    const countRange = maxCount - minCount || 1;

    // Randomize order for better visual distribution
    const shuffled = [...items].sort(() => Math.random() - 0.5);

    this.wordCloudItems = shuffled.map((item) => {
      const normalized = (item.count - minCount) / countRange;
      const size = this.minFontSize() + normalized * (this.maxFontSize() - this.minFontSize());
      const color = this.getColor(item.text);

      return {
        ...item,
        size,
        color,
      };
    });
  }

  private getColor(text: string): string {
    if (this.randomizeColors()) {
      return this.generateRandomColor();
    }

    const colorScheme = this.colorScheme();
    const colors = this.getColorPalette(colorScheme);
    const hash = this.hashCode(text);
    return colors[Math.abs(hash) % colors.length];
  }

  private getColorPalette(scheme: string): string[] {
    const palettes: { [key: string]: string[] } = {
      default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
      warm: ['#f59e0b', '#ef4444', '#dc2626', '#d97706', '#b91c1c', '#ea580c'],
      cool: ['#06b6d4', '#0ea5e9', '#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a'],
      vibrant: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06ffa5'],
    };

    return palettes[scheme] || palettes['default'];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  private generateRandomColor(): string {
    const colors = this.getColorPalette(this.colorScheme());
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
