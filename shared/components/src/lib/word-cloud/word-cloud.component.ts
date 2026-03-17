import {
  Component,
  input,
  output,
  ViewChild,
  ElementRef,
  AfterViewInit,
  AfterContentChecked,
  OnDestroy,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  signal,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { WordCloudItem } from './word-cloud.types';
import * as d3 from 'd3';
import { WordCloudDataService } from '../services/word-cloud-data.service';

interface CloudWord {
  text: string;
  count: number;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
}

@Component({
  selector: 'lib-word-cloud',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordCloudComponent implements AfterViewInit, AfterContentChecked, OnDestroy {
  /** Array of items with text and count */
  items = input.required<WordCloudItem[]>();

  /** Optional title for the word cloud */
  title = input<string | null>(null);

  /** Optional subtitle for the word cloud */
  subtitle = input<string | null>(null);

  /** Color scheme: 'default', 'warm', 'cool', 'vibrant' */
  colorScheme = input<'default' | 'warm' | 'cool' | 'vibrant'>('default');

  /** Minimum font size in pixels */
  minFontSize = input(14);

  /** Maximum font size in pixels */
  maxFontSize = input(72);

  /** Optional width for the word cloud */
  width = input(800);

  /** Optional height for the word cloud */
  height = input(500);

  /** Filter inputs */
  selectedYear = input<number | null>(null);
  selectedCountry = input<number | null>(null);

  /** Filter outputs */
  yearChange = output<number | null>();
  countryChange = output<number | null>();

  /** Show filters */
  showFilters = input(true);

  // Signal to store unfiltered count
  unfilteredCount = signal(0);

  // Total tags in database
  totalTagsCount = signal(0);

  // Available options from database
  availableYears = signal<number[]>([]);
  availableCountries = signal<{ id: number; name: string }[]>([]);

  // Error state
  error = signal<string | null>(null);

  private wordCloudDataService = inject(WordCloudDataService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('wordCloudContainer') wordCloudContainer!: ElementRef<HTMLDivElement>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cloudLayout: any;
  private lastItemsLength = 0;

  ngAfterViewInit(): void {
    // Load filter options first
    this.loadFilterOptions();
    // Store the initial unfiltered count
    this.unfilteredCount.set(this.items().length);
    this.generateWordCloud();
    this.lastItemsLength = this.items().length;
  }

  ngAfterContentChecked(): void {
    // Re-render if items count changed
    const currentLength = this.items().length;
    if (currentLength !== this.lastItemsLength && this.viewReady) {
      this.lastItemsLength = currentLength;
      this.generateWordCloud();
    }
  }

  private viewReady = true;

  ngOnDestroy(): void {
    if (this.cloudLayout) {
      this.cloudLayout.stop();
    }
  }

  private generateWordCloud(): void {
    const items = this.items();
    if (!items || items.length === 0) {
      return;
    }

    const container = this.wordCloudContainer?.nativeElement;
    if (!container) {
      return;
    }

    d3.select(container).selectAll('*').remove();

    const minCount = Math.min(...items.map((i) => i.count));
    const maxCount = Math.max(...items.map((i) => i.count));
    const countRange = maxCount - minCount || 1;

    const sizeScale = (count: number) => {
      const normalized = (count - minCount) / countRange;
      return this.minFontSize() + normalized * (this.maxFontSize() - this.minFontSize());
    };

    const width = this.width();
    const height = this.height();

    // Create word data with random positions
    const cloudData: CloudWord[] = items.map((item) => ({
      text: item.text,
      count: item.count,
      size: sizeScale(item.count),
      x: (Math.random() - 0.5) * width * 0.8,
      y: (Math.random() - 0.5) * height * 0.8,
      rotate: 0,
    }));

    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    this.drawWords(g, cloudData);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawWords(svg: any, words: CloudWord[]): void {
    const colorScheme = this.colorScheme();
    const colors = this.getColorPalette(colorScheme);

    const text = svg
      .selectAll('text')
      .data(words)
      .enter()
      .append('text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .style('font-size', (d: any) => `${d.size}px`)
      .style('font-weight', '500')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .style('fill', (d: any) => colors[Math.abs(this.hashCode(d.text)) % colors.length])
      .attr('text-anchor', 'middle')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .text((d: any) => d.text)
      .style('cursor', 'pointer')
      .style('user-select', 'none')
      .style('transition', 'all 0.3s ease');

    text
      .on('mouseenter', function (this: HTMLElement) {
        d3.select(this)
          .style('font-weight', '700')
          .style('opacity', '0.8')
          .style('filter', 'brightness(1.2)');
      })
      .on('mouseleave', function (this: HTMLElement) {
        d3.select(this)
          .style('font-weight', '500')
          .style('opacity', '1')
          .style('filter', 'brightness(1)');
      });
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
      hash = hash & hash;
    }
    return hash;
  }

  // Load available years, countries, and total tag count from the database
  private loadFilterOptions(): void {
    this.wordCloudDataService
      .getWordCloudInitialData()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((data) => {
          if (data) {
            this.availableYears.set(data.years);
            this.availableCountries.set(data.countries);
            this.totalTagsCount.set(data.totalTagsCount);
            this.error.set(null);
          }
        }),
        catchError((err) => {
          console.error('Failed to load initial data:', err);
          this.error.set('Failed to load word cloud data. Please try again.');
          return of(null);
        })
      )
      .subscribe();
  }

  // Filter methods
  onYearChange(value: string): void {
    const year = value ? parseInt(value, 10) : null;
    this.yearChange.emit(year);
  }

  onCountryChange(value: string): void {
    const countryId = value ? parseInt(value, 10) : null;
    this.countryChange.emit(countryId);
  }
}
