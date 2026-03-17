import {
  Component,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AnalyticsService,
  AnalyticsData,
  EntityBreakdown,
  TimeSeriesPoint,
  PhotosByEntity,
  EntityGrowth,
  CountriesPerRegion,
} from '../../services/analytics.service';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { WordCloudService, WordCloudItem } from '../../services/word-cloud.service';
import { WordCloudComponent } from '@shared/components';
import { forkJoin, catchError, of } from 'rxjs';
import * as d3 from 'd3';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, WordCloudComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private dashboardService = inject(DashboardService);
  private wordCloudService = inject(WordCloudService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @ViewChild('entityDonut') entityDonutEl?: ElementRef<HTMLDivElement>;
  @ViewChild('photosBar') photosBarEl?: ElementRef<HTMLDivElement>;
  @ViewChild('photosEntity') photosEntityEl?: ElementRef<HTMLDivElement>;
  @ViewChild('countriesRegion') countriesRegionEl?: ElementRef<HTMLDivElement>;
  @ViewChild('photosYear') photosYearEl?: ElementRef<HTMLDivElement>;
  @ViewChild('entityGrowth') entityGrowthEl?: ElementRef<HTMLDivElement>;

  loading = signal(true);
  error = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  analytics = signal<AnalyticsData | null>(null);
  wordCloudItems = signal<WordCloudItem[]>([]);

  // Word cloud filters
  selectedYear = signal<number | null>(null);
  selectedCountry = signal<number | null>(null);
  availableYears = signal<number[]>([]);
  availableCountries = signal<string[]>([]);

  private resizeObserver?: ResizeObserver;
  private resizeDebounceTimer?: ReturnType<typeof setTimeout>;
  private chartContainerEls: ElementRef<HTMLDivElement>[] = [];

  private data$ = forkJoin({
    stats: this.dashboardService.getStats().pipe(catchError(() => of(null))),
    analytics: this.analyticsService.getAnalytics().pipe(catchError(() => of(null))),
    wordCloudItems: this.wordCloudService.getTagFrequencies().pipe(catchError(() => of([]))),
  });
  private data = toSignal(this.data$.pipe(takeUntilDestroyed()));

  constructor() {
    // Load main analytics data
    effect(() => {
      const d = this.data();
      if (d) {
        const { stats, analytics, wordCloudItems } = d;
        if (stats) this.stats.set(stats);
        if (analytics) {
          this.analytics.set(analytics);
          Promise.resolve().then(() => {
            this.renderAllCharts(analytics);
            this.setupResizeObserver();
          });
        }
        if (wordCloudItems) this.wordCloudItems.set(wordCloudItems);
        if (!stats && !analytics) {
          this.error.set('Failed to load analytics data. Please try again.');
        }
        this.loading.set(false);
        this.cdr.markForCheck();
      }
    });

    // Load word cloud tags separately
    this.wordCloudService
      .getTagFrequencies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          console.log('Word cloud tags loaded:', tags);
          this.wordCloudItems.set(tags);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load word cloud tags:', err);
        },
      });
  }

  ngOnDestroy(): void {
    // Clear resize debounce timer
    if (this.resizeDebounceTimer) clearTimeout(this.resizeDebounceTimer);

    // Disconnect resize observer
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    // Cancel all active D3 transitions and remove event listeners from chart containers
    this.cleanupAllCharts();
  }

  // Word cloud filter methods
  onYearChange(year: number | null): void {
    console.log('Year changed to:', year);
    this.selectedYear.set(year);
    this.loadFilteredWordCloud();
  }

  onCountryChange(country: number | null): void {
    console.log('Country changed to:', country);
    this.selectedCountry.set(country);
    this.loadFilteredWordCloud();
  }

  parseYearValue(value: string): number | null {
    return value ? parseInt(value, 10) : null;
  }

  private loadFilteredWordCloud(): void {
    const year = this.selectedYear();
    const country = this.selectedCountry();

    console.log('Loading filtered word cloud with year:', year, 'country:', country);

    this.wordCloudService
      .getTagFrequencies(year ?? undefined, country ?? undefined)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.error('Failed to load filtered word cloud tags:', err);
          return of([]);
        })
      )
      .subscribe({
        next: (tags) => {
          console.log('Filtered tags received:', tags);
          this.wordCloudItems.set(tags);
          this.cdr.markForCheck();
        },
      });
  }

  // ...existing code...
  private setupResizeObserver(): void {
    if (this.resizeObserver || !this.entityDonutEl?.nativeElement) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeDebounceTimer) clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = setTimeout(() => {
        const current = this.analytics();
        if (current) this.renderAllCharts(current);
      }, 200);
    });

    const parent = this.entityDonutEl.nativeElement.parentElement;
    if (parent) this.resizeObserver.observe(parent);
  }

  private renderAllCharts(data: AnalyticsData): void {
    // Track all chart container ElementRefs for cleanup
    this.chartContainerEls = [
      this.entityDonutEl,
      this.photosBarEl,
      this.photosEntityEl,
      this.countriesRegionEl,
      this.photosYearEl,
      this.entityGrowthEl,
    ].filter((el): el is ElementRef<HTMLDivElement> => !!el);

    this.renderEntityDonut(data.entityBreakdown);
    this.renderPhotosBar(data.photosByMonth);
    this.renderPhotosEntity(data.photosByEntity);
    this.renderCountriesPerRegion(data.countriesPerRegion);
    this.renderPhotosPerYear(data.photosPerYear);
    this.renderEntityGrowth(data.entityGrowth);
  }

  /** Cancel D3 transitions and remove all D3-managed DOM from chart containers */
  private cleanupAllCharts(): void {
    for (const elRef of this.chartContainerEls) {
      this.cleanupChartElement(elRef.nativeElement);
    }
    this.chartContainerEls = [];
  }

  /** Interrupt active transitions and clear all children from a chart container */
  private cleanupChartElement(el: HTMLElement): void {
    // Interrupt all active D3 transitions to release held references
    d3.select(el).selectAll('*').interrupt();
    // Remove all D3-managed DOM (SVGs, tooltips, legends)
    d3.select(el).selectAll('*').remove();
  }

  // ... (rest of the chart rendering methods are unchanged)
  // ─── Donut Chart: Entity Breakdown ───
  private renderEntityDonut(data: EntityBreakdown[]): void {
    const el = this.entityDonutEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const width = el.clientWidth;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 20;

    const colors = d3
      .scaleOrdinal<string>()
      .domain(data.map((d) => d.name))
      .range(['#667eea', '#764ba2', '#f093fb', '#4fd1c5', '#f6ad55', '#fc8181']);

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3
      .pie<EntityBreakdown>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<EntityBreakdown>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius);

    const hoverArc = d3
      .arc<d3.PieArcDatum<EntityBreakdown>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius + 8);

    const tooltip = d3.select(el).append('div').attr('class', 'chart-tooltip').style('opacity', 0);

    svg
      .selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => colors(d.data.name))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', hoverArc as unknown as string);
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip
          .html(`<strong>${d.data.name}</strong><br/>${d.data.value.toLocaleString()}`)
          .style('left', `${event.offsetX + 10}px`)
          .style('top', `${event.offsetY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc as unknown as string);
        tooltip.transition().duration(300).style('opacity', 0);
      });

    const total = data.reduce((sum, d) => sum + d.value, 0);
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('class', 'donut-total')
      .text(total.toLocaleString());
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('class', 'donut-label')
      .text('Total Records');

    const legend = d3.select(el).append('div').attr('class', 'chart-legend');

    data.forEach((d) => {
      const item = legend.append('div').attr('class', 'legend-item');
      item.append('span').attr('class', 'legend-swatch').style('background', colors(d.name));
      item.append('span').text(`${d.name} (${d.value.toLocaleString()})`);
    });
  }

  // ─── Bar Chart: Photos by Month ───
  private renderPhotosBar(data: TimeSeriesPoint[]): void {
    const el = this.photosBarEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const margin = { top: 20, right: 20, bottom: 60, left: 50 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.date))
      .range([0, width])
      .padding(0.3);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([height, 0]);

    const gridAxis = d3
      .axisLeft(y)
      .tickSize(-width)
      .tickFormat(() => '');
    svg.append('g').attr('class', 'grid').call(gridAxis);

    const tooltip = d3.select(el).append('div').attr('class', 'chart-tooltip').style('opacity', 0);

    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.date) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#667eea')
      .attr('rx', 3)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', '#764ba2');
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip
          .html(`<strong>${d.date}</strong><br/>${d.count} photos`)
          .style('left', `${event.offsetX + 10}px`)
          .style('top', `${event.offsetY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', '#667eea');
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 60)
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count));

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em');

    svg.append('g').call(d3.axisLeft(y).ticks(5));
  }

  // ─── Horizontal Bar: Photos by Entity ───
  private renderPhotosEntity(data: PhotosByEntity[]): void {
    const el = this.photosEntityEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const margin = { top: 20, right: 30, bottom: 30, left: 90 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const colors = ['#667eea', '#764ba2', '#f093fb', '#4fd1c5', '#9ca3af'];

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.entity))
      .range([0, height])
      .padding(0.3);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([0, width]);

    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('y', (d) => y(d.entity) ?? 0)
      .attr('height', y.bandwidth())
      .attr('x', 0)
      .attr('width', 0)
      .attr('fill', (_, i) => colors[i % colors.length])
      .attr('rx', 3)
      .transition()
      .duration(800)
      .delay((_, i) => i * 100)
      .attr('width', (d) => x(d.count));

    svg
      .selectAll('.label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('y', (d) => (y(d.entity) ?? 0) + y.bandwidth() / 2)
      .attr('x', (d) => x(d.count) + 5)
      .attr('dy', '0.35em')
      .text((d) => d.count.toLocaleString());

    svg.append('g').call(d3.axisLeft(y));
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5));
  }

  // ─── Horizontal Bar Chart: Visited Countries per Region ───
  private renderCountriesPerRegion(data: CountriesPerRegion[]): void {
    const el = this.countriesRegionEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const margin = { top: 20, right: 40, bottom: 40, left: 120 };
    const barHeight = 28;
    const gap = 6;
    const height = data.length * (barHeight + gap);
    const width = el.clientWidth - margin.left - margin.right;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.region))
      .range([0, height])
      .padding(0.2);

    const gridAxis = d3
      .axisBottom(x)
      .tickSize(height)
      .tickFormat(() => '');
    svg.append('g').attr('class', 'grid').call(gridAxis);

    const colors = d3.scaleOrdinal(d3.schemeTableau10);

    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.region) ?? 0)
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('fill', (_, i) => colors(String(i)))
      .attr('rx', 3)
      .transition()
      .duration(800)
      .delay((_, i) => i * 80)
      .attr('width', (d) => x(d.count));

    svg
      .selectAll('.val-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-val-label')
      .attr('x', (d) => x(d.count) + 5)
      .attr('y', (d) => (y(d.region) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .text((d) => d.count);

    svg.append('g').call(d3.axisLeft(y));
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5));
  }

  // ─── Line Chart: Photos Per Year ───
  private renderPhotosPerYear(data: TimeSeriesPoint[]): void {
    const el = this.photosYearEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.date))
      .range([0, width])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([height, 0]);

    const gridAxis = d3
      .axisLeft(y)
      .tickSize(-width)
      .tickFormat(() => '');
    svg.append('g').attr('class', 'grid').call(gridAxis);

    // Area fill
    const area = d3
      .area<TimeSeriesPoint>()
      .x((d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .y0(height)
      .y1((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    svg.append('path').datum(data).attr('fill', 'rgba(102, 126, 234, 0.15)').attr('d', area);

    // Line
    const line = d3
      .line<TimeSeriesPoint>()
      .x((d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .y((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    const path = svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#667eea')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Animate line drawing
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() ?? 0;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    // Dots
    const tooltip = d3.select(el).append('div').attr('class', 'chart-tooltip').style('opacity', 0);

    svg
      .selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .attr('cy', (d) => y(d.count))
      .attr('r', 4)
      .attr('fill', '#667eea')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).transition().duration(200).attr('r', 6);
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip
          .html(`<strong>${d.date}</strong><br/>${d.count.toLocaleString()} photos`)
          .style('left', `${event.offsetX + 10}px`)
          .style('top', `${event.offsetY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this).transition().duration(200).attr('r', 4);
        tooltip.transition().duration(300).style('opacity', 0);
      });

    // Value labels above dots
    svg
      .selectAll('.val-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-val-label')
      .attr('x', (d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.count) - 10)
      .attr('text-anchor', 'middle')
      .text((d) => d.count.toLocaleString());

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).ticks(5));
  }

  // ─── Stacked Bar: Entity Growth ───
  private renderEntityGrowth(data: EntityGrowth[]): void {
    const el = this.entityGrowthEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const margin = { top: 20, right: 20, bottom: 60, left: 50 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const keys = ['countries', 'states', 'cities', 'attractions'] as const;
    const colorMap: Record<string, string> = {
      countries: '#667eea',
      states: '#764ba2',
      cities: '#f093fb',
      attractions: '#4fd1c5',
    };

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.month))
      .range([0, width])
      .padding(0.2);

    const maxY = d3.max(data, (d) => keys.reduce((sum, k) => sum + d[k], 0)) || 1;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([height, 0]);

    const gridAxis = d3
      .axisLeft(y)
      .tickSize(-width)
      .tickFormat(() => '');
    svg.append('g').attr('class', 'grid').call(gridAxis);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stack = d3.stack<EntityGrowth>().keys(keys as any);
    const series = stack(data);

    svg
      .selectAll('g.layer')
      .data(series)
      .enter()
      .append('g')
      .attr('class', 'layer')
      .attr('fill', (d) => colorMap[d.key])
      .selectAll('rect')
      .data((d) => d)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.data.month) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .transition()
      .duration(800)
      .delay((_, i) => i * 40)
      .attr('y', (d) => y(d[1]))
      .attr('height', (d) => y(d[0]) - y(d[1]));

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em');

    svg.append('g').call(d3.axisLeft(y).ticks(5));

    const legend = d3.select(el).append('div').attr('class', 'chart-legend');
    keys.forEach((key) => {
      const item = legend.append('div').attr('class', 'legend-item');
      item.append('span').attr('class', 'legend-swatch').style('background', colorMap[key]);
      item.append('span').text(key.charAt(0).toUpperCase() + key.slice(1));
    });
  }
}
