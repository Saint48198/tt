import {
  Component,
  input,
  output,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  signal,
  inject,
  DestroyRef,
  effect,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { WordCloudItem } from './word-cloud.types';
import * as d3 from 'd3';
import { WordCloudService } from './word-cloud.service';

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
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './word-cloud.component.html',
  styleUrl: './word-cloud.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordCloudComponent implements AfterViewInit, OnDestroy {
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

  // Filter overlay minimize state
  filtersMinimized = signal(false);

  toggleFilters(): void {
    this.filtersMinimized.update((v) => !v);
  }

  private wordCloudService = inject(WordCloudService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('wordCloudContainer') wordCloudContainer!: ElementRef<HTMLDivElement>;

  // Internal filter state (driven by both the dropdown UI and parent inputs)
  private activeYear = signal<number | null>(null);
  private activeCountry = signal<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cloudLayout: any;
  private viewReady = false;

  // Internal items signal — holds the currently displayed words (filtered or unfiltered)
  private displayItems = signal<WordCloudItem[]>([]);

  // True while the initial items haven't been set yet
  loading = signal(true);

  // True when the service returned no results for the current filters
  noResults = signal(false);

  constructor() {
    // Watch internal filter signals and re-fetch data whenever they change
    effect(() => {
      const year = this.activeYear();
      const country = this.activeCountry();
      untracked(() => {
        if (this.viewReady) {
          this.fetchAndRender(year, country);
        }
      });
    });

    // Re-render when displayItems change (only after view is ready)
    effect(() => {
      const items = this.displayItems();
      untracked(() => {
        if (!this.viewReady) return;
        this.loading.set(false);
        this.noResults.set(items.length === 0);
        if (items.length > 0) {
          // Defer one tick so Angular can unhide the container before D3 renders
          setTimeout(() => this.generateWordCloud(items));
        }
      });
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadFilterOptions();
    const initial = this.items();
    this.unfilteredCount.set(initial.length);
    this.loading.set(false);
    this.noResults.set(initial.length === 0);
    this.displayItems.set(initial);
    if (initial.length > 0) {
      setTimeout(() => this.generateWordCloud(initial));
    }
  }

  ngOnDestroy(): void {
    if (this.cloudLayout) {
      this.cloudLayout.stop();
    }
  }

  private fetchAndRender(year: number | null, country: number | null): void {
    if (year || country) {
      this.wordCloudService
        .getTagFrequencies(year ?? undefined, country ?? undefined)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((items) => {
          this.displayItems.set(items);
        });
    } else {
      // No filters — revert to the items passed in by the parent
      this.displayItems.set(this.items());
    }
  }

  private generateWordCloud(items: WordCloudItem[]): void {
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

    // Measure each word's bounding box using a hidden SVG
    const measureSvg = d3
      .select(container)
      .append('svg')
      .attr('width', 0)
      .attr('height', 0)
      .style('position', 'absolute')
      .style('visibility', 'hidden');

    const placed: { x: number; y: number; w: number; h: number; rotate: number }[] = [];
    const cloudData: CloudWord[] = [];
    const maxRadius = Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
    const padding = 2;

    for (const item of items) {
      const size = sizeScale(item.count);
      // Candidate rotation — only allow vertical for edge placements, ~12.5% chance
      const candidateRotate = Math.random() < 0.125 ? 90 : 0;

      // Measure text dimensions
      const measurer = measureSvg
        .append('text')
        .style('font-size', `${size}px`)
        .style('font-weight', '500')
        .text(item.text);
      const bbox = (measurer.node() as SVGTextElement).getBBox();
      measurer.remove();

      const tw = candidateRotate === 90 ? bbox.height : bbox.width;
      const th = candidateRotate === 90 ? bbox.width : bbox.height;

      // Archimedean spiral outward from center
      let placed_x: number | null = null;
      let placed_y: number | null = null;
      let finalRotate = candidateRotate;

      for (let t = 0; t < 500; t++) {
        const angle = t * 0.25;
        const r = t * 1.2;
        const cx = r * Math.cos(angle);
        const cy = r * (height / width) * Math.sin(angle);

        // Stay within canvas bounds (coords are relative to centre)
        if (
          Math.abs(cx) + tw / 2 > width / 2 - padding ||
          Math.abs(cy) + th / 2 > height / 2 - padding
        ) {
          continue;
        }

        // Only allow vertical for edge words
        const dist = Math.sqrt(cx * cx + cy * cy);
        const isEdge = dist / maxRadius > 0.7;
        const rotate = isEdge ? candidateRotate : 0;
        const w = rotate === 90 ? bbox.height : bbox.width;
        const h = rotate === 90 ? bbox.width : bbox.height;

        // Check collision against already-placed words
        const overlaps = placed.some((p) => {
          return (
            Math.abs(cx - p.x) < (w + p.w) / 2 + padding &&
            Math.abs(cy - p.y) < (h + p.h) / 2 + padding
          );
        });

        if (!overlaps) {
          placed_x = cx;
          placed_y = cy;
          finalRotate = rotate;
          placed.push({ x: cx, y: cy, w, h, rotate });
          break;
        }
      }

      // Only add the word if it could be placed
      if (placed_x !== null && placed_y !== null) {
        cloudData.push({
          text: item.text,
          count: item.count,
          size,
          x: placed_x,
          y: placed_y,
          rotate: finalRotate,
        });
      }
    }

    measureSvg.remove();

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
    this.wordCloudService
      .getInitialData()
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
    this.activeYear.set(year);
    this.yearChange.emit(year);
  }

  onCountryChange(value: string): void {
    const countryId = value ? parseInt(value, 10) : null;
    this.activeCountry.set(countryId);
    this.countryChange.emit(countryId);
  }
}
