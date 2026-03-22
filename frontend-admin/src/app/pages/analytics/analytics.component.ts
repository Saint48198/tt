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
  PhotosByCountry,
} from '../../services/analytics.service';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { WordCloudService, WordCloudItem } from '../../services/word-cloud.service';
import { WordCloudComponent, WordCloudFilters } from '@shared/components';
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
  @ViewChild('photosCountry') photosCountryEl?: ElementRef<HTMLDivElement>;

  loading = signal(true);
  error = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  analytics = signal<AnalyticsData | null>(null);
  wordCloudItems = signal<WordCloudItem[]>([]);
  wordCloudFilters = signal<WordCloudFilters>({});
  selectedEntity = signal<string | null>(null);
  excludeUS = signal(false);

  toggleExcludeUS(): void {
    this.excludeUS.set(!this.excludeUS());
    const current = this.analytics();
    if (current) {
      Promise.resolve().then(() => this.renderPhotosByCountry(current.photosByCountry ?? []));
    }
  }

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

  // Word cloud filter handler
  onFiltersChange(filters: WordCloudFilters): void {
    this.wordCloudFilters.set(filters);
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
      this.photosCountryEl,
    ].filter((el): el is ElementRef<HTMLDivElement> => !!el);

    this.renderEntityDonut(data.entityBreakdown);
    this.renderPhotosBar(data.photosByMonth);
    this.renderPhotosEntity(data.photosByEntity);
    this.renderCountriesPerRegion(data.countriesPerRegion);
    this.renderPhotosPerYear(data.photosPerYear);
    this.renderEntityGrowth(data.entityGrowth);
    this.renderPhotosByCountry(data.photosByCountry ?? []);
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
  private renderEntityDonut(rawData: EntityBreakdown[]): void {
    const data = rawData.filter((d) => d.name !== 'Photos');
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

    const svgRoot = d3.select(el).append('svg').attr('width', width).attr('height', height);

    const svg = svgRoot.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

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

    const selectedArc = d3
      .arc<d3.PieArcDatum<EntityBreakdown>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius + 12);

    const tooltip = d3.select(el).append('div').attr('class', 'chart-tooltip').style('opacity', 0);

    // Helper to sync visual state after selection changes
    const applySelectionState = (selected: string | null) => {
      // Update slices
      svg
        .selectAll<SVGPathElement, d3.PieArcDatum<EntityBreakdown>>('path')
        .transition()
        .duration(200)
        .attr('d', (d) =>
          selected === null || d.data.name === selected
            ? selected === d.data.name
              ? selectedArc(d)
              : arc(d)
            : arc(d)
        )
        .style('opacity', (d) => (selected === null || d.data.name === selected ? 1 : 0.3));

      // Update legend items
      d3.select(el)
        .selectAll<HTMLDivElement, EntityBreakdown>('.legend-item')
        .style('opacity', (d) => (selected === null || d.name === selected ? 1 : 0.4))
        .style('font-weight', (d) => (d.name === selected ? '600' : '400'));

      // Update centre text
      if (selected !== null) {
        const item = data.find((d) => d.name === selected);
        centerTotal.text(item ? item.value.toLocaleString() : '');
        centerLabel.text(selected);
      } else {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        centerTotal.text(total.toLocaleString());
        centerLabel.text('Total Records');
      }

      // Show/hide the clear-filter badge
      d3.select(el)
        .select('.entity-filter-clear')
        .style('display', selected ? 'inline-flex' : 'none');
    };

    const toggleSelection = (name: string) => {
      const current = this.selectedEntity();
      const next = current === name ? null : name;
      this.selectedEntity.set(next);
      applySelectionState(next);
    };

    // Capture component reference for use inside D3 callbacks
    const getSelectedEntity = () => this.selectedEntity();

    const paths = svg
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
        const activeFilter = getSelectedEntity();
        // Only expand on hover if no filter is active, or this is the active slice
        if (activeFilter === null || activeFilter === d.data.name) {
          d3.select<SVGPathElement, d3.PieArcDatum<EntityBreakdown>>(this as SVGPathElement)
            .transition()
            .duration(200)
            .attr('d', hoverArc as unknown as string);
        }
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip
          .html(`<strong>${d.data.name}</strong><br/>${d.data.value.toLocaleString()}`)
          .style('left', `${event.offsetX + 10}px`)
          .style('top', `${event.offsetY - 28}px`);
      })
      .on('mouseout', function (_event, d) {
        const activeFilter = getSelectedEntity();
        // Restore: if this slice is the active selection use selectedArc, otherwise normal arc
        const targetArc = activeFilter === d.data.name ? selectedArc : arc;
        d3.select<SVGPathElement, d3.PieArcDatum<EntityBreakdown>>(this as SVGPathElement)
          .transition()
          .duration(200)
          .attr('d', targetArc as unknown as string);
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .on('click', (_event, d) => {
        tooltip.transition().duration(100).style('opacity', 0);
        toggleSelection(d.data.name);
      });

    void paths; // suppress unused warning

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const centerTotal = svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('class', 'donut-total')
      .text(total.toLocaleString());
    const centerLabel = svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('class', 'donut-label')
      .text('Total Records');

    // Clear-filter badge (hidden by default)
    const clearBadge = d3
      .select(el)
      .append('div')
      .attr('class', 'entity-filter-clear')
      .style('display', 'none')
      .style('cursor', 'pointer')
      .on('click', () => {
        this.selectedEntity.set(null);
        applySelectionState(null);
      });
    clearBadge.append('span').attr('class', 'entity-filter-clear-icon').text('✕');
    clearBadge.append('span').attr('class', 'entity-filter-clear-label').text('Clear filter');

    const legend = d3.select(el).append('div').attr('class', 'chart-legend');

    data.forEach((d) => {
      const item = legend
        .append('div')
        .attr('class', 'legend-item')
        .datum(d)
        .style('cursor', 'pointer')
        .on('click', () => toggleSelection(d.name))
        .on('mouseenter', function () {
          d3.select(this).style('text-decoration', 'underline');
        })
        .on('mouseleave', function () {
          d3.select(this).style('text-decoration', 'none');
        });
      item.append('span').attr('class', 'legend-swatch').style('background', colors(d.name));
      item.append('span').text(`${d.name} (${d.value.toLocaleString()})`);
    });

    // Restore previous selection state if there was one (e.g. after resize re-render)
    const existing = this.selectedEntity();
    if (existing) {
      applySelectionState(existing);
    }
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
      .call(d3.axisBottom(x).tickValues(data.map((d) => d.date).filter((_, i) => i % 5 === 0)))
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

  // ─── Bar Chart: Photos by Country ───
  private renderPhotosByCountry(rawData: PhotosByCountry[]): void {
    const data = this.excludeUS() ? rawData.filter((d) => d.country !== 'United States') : rawData;
    const el = this.photosCountryEl?.nativeElement;
    if (!el || !data.length) return;
    this.cleanupChartElement(el);

    const margin = { top: 20, right: 20, bottom: 100, left: 55 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.country))
      .range([0, width])
      .padding(0.25);

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
      .attr('x', (d) => x(d.country) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#667eea')
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', '#4338ca');
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip
          .html(`<strong>${d.country}</strong><br/>${d.count.toLocaleString()} photos`)
          .style('left', `${event.offsetX + 10}px`)
          .style('top', `${event.offsetY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', '#667eea');
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 40)
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count));

    // X axis — show every 5th label to avoid crowding
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickValues(data.map((d) => d.country).filter((_, i) => i % 5 === 0)))
      .selectAll('text')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em');

    svg.append('g').call(d3.axisLeft(y).ticks(5));
  }
}
