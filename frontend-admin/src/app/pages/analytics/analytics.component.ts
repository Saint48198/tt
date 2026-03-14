import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewChecked,
} from '@angular/core';
import {
  AnalyticsService,
  AnalyticsData,
  EntityBreakdown,
  TimeSeriesPoint,
  PhotosByEntity,
  TripTimeline,
  EntityGrowth,
} from '../../services/analytics.service';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { forkJoin, catchError, of, Subscription } from 'rxjs';
import * as d3 from 'd3';

@Component({
  selector: 'app-analytics',
  standalone: true,
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit, AfterViewChecked, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private dashboardService = inject(DashboardService);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;

  @ViewChild('entityDonut') entityDonutEl?: ElementRef<HTMLDivElement>;
  @ViewChild('photosBar') photosBarEl?: ElementRef<HTMLDivElement>;
  @ViewChild('photosEntity') photosEntityEl?: ElementRef<HTMLDivElement>;
  @ViewChild('tripTimeline') tripTimelineEl?: ElementRef<HTMLDivElement>;
  @ViewChild('tripsYear') tripsYearEl?: ElementRef<HTMLDivElement>;
  @ViewChild('entityGrowth') entityGrowthEl?: ElementRef<HTMLDivElement>;

  loading = signal(true);
  error = signal<string | null>(null);
  stats = signal<DashboardStats | null>(null);
  analytics = signal<AnalyticsData | null>(null);

  private chartsRendered = false;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewChecked(): void {
    // Render charts once the ViewChild refs become available after @if/else renders
    const data = this.analytics();
    if (data && !this.chartsRendered && this.entityDonutEl?.nativeElement) {
      this.chartsRendered = true;
      this.renderAllCharts(data);

      // Set up resize observer now that elements exist
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(() => {
          const current = this.analytics();
          if (current) this.renderAllCharts(current);
        });
        const parent = this.entityDonutEl.nativeElement.parentElement;
        if (parent) this.resizeObserver.observe(parent);
      }
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.subscription = forkJoin({
      stats: this.dashboardService.getStats().pipe(catchError(() => of(null))),
      analytics: this.analyticsService.getAnalytics().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ stats, analytics }) => {
        if (stats) this.stats.set(stats);
        if (analytics) {
          this.analytics.set(analytics);
        }
        if (!stats && !analytics) {
          this.error.set('Failed to load analytics data. Please try again.');
        }
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Failed to load analytics data.');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  private renderAllCharts(data: AnalyticsData): void {
    this.renderEntityDonut(data.entityBreakdown);
    this.renderPhotosBar(data.photosByMonth);
    this.renderPhotosEntity(data.photosByEntity);
    this.renderTripTimeline(data.tripTimeline);
    this.renderTripsYear(data.tripsPerYear);
    this.renderEntityGrowth(data.entityGrowth);
  }

  // ─── Donut Chart: Entity Breakdown ───
  private renderEntityDonut(data: EntityBreakdown[]): void {
    const el = this.entityDonutEl?.nativeElement;
    if (!el || !data.length) return;
    d3.select(el).selectAll('*').remove();

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
    d3.select(el).selectAll('*').remove();

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
    d3.select(el).selectAll('*').remove();

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

  // ─── Gantt-style: Trip Timeline ───
  private renderTripTimeline(data: TripTimeline[]): void {
    const el = this.tripTimelineEl?.nativeElement;
    if (!el || !data.length) return;
    d3.select(el).selectAll('*').remove();

    const sorted = [...data].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const margin = { top: 20, right: 30, bottom: 40, left: 140 };
    const barHeight = 22;
    const gap = 6;
    const height = sorted.length * (barHeight + gap) + margin.top + margin.bottom;
    const width = el.clientWidth - margin.left - margin.right;

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const allDates = sorted.flatMap((d) => [new Date(d.startDate), new Date(d.endDate)]);
    const x = d3
      .scaleTime()
      .domain([d3.min(allDates) || new Date(), d3.max(allDates) || new Date()])
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(sorted.map((d) => d.name))
      .range([0, sorted.length * (barHeight + gap)])
      .padding(0.15);

    const colors = d3.scaleOrdinal(d3.schemeSet2);

    const tooltip = d3.select(el).append('div').attr('class', 'chart-tooltip').style('opacity', 0);

    svg
      .selectAll('.trip-bar')
      .data(sorted)
      .enter()
      .append('rect')
      .attr('y', (d) => y(d.name) ?? 0)
      .attr('height', y.bandwidth())
      .attr('x', (d) => x(new Date(d.startDate)))
      .attr('width', 0)
      .attr('fill', (_, i) => colors(String(i)))
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        tooltip.transition().duration(200).style('opacity', 1);
        const start = new Date(d.startDate).toLocaleDateString();
        const end = new Date(d.endDate).toLocaleDateString();
        tooltip
          .html(
            `<strong>${d.name}</strong><br/>` +
              `${start} – ${end}<br/>` +
              `${d.planItemCount} plan items`
          )
          .style('left', `${event.offsetX + 10}px`)
          .style('top', `${event.offsetY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 50)
      .attr('width', (d) => Math.max(x(new Date(d.endDate)) - x(new Date(d.startDate)), 4));

    svg.append('g').call(d3.axisLeft(y));
    const bottomAxis = d3
      .axisBottom(x)
      .ticks(6)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .tickFormat(d3.timeFormat('%b %Y') as any);
    svg
      .append('g')
      .attr('transform', `translate(0,${sorted.length * (barHeight + gap)})`)
      .call(bottomAxis);
  }

  // ─── Bar Chart: Trips Per Year ───
  private renderTripsYear(data: TimeSeriesPoint[]): void {
    const el = this.tripsYearEl?.nativeElement;
    if (!el || !data.length) return;
    d3.select(el).selectAll('*').remove();

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
      .padding(0.4);

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

    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.date) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#4fd1c5')
      .attr('rx', 3)
      .transition()
      .duration(800)
      .delay((_, i) => i * 100)
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count));

    svg
      .selectAll('.val-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-val-label')
      .attr('x', (d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.count) - 5)
      .attr('text-anchor', 'middle')
      .text((d) => d.count);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).ticks(5));
  }

  // ─── Stacked Bar: Entity Growth ───
  private renderEntityGrowth(data: EntityGrowth[]): void {
    const el = this.entityGrowthEl?.nativeElement;
    if (!el || !data.length) return;
    d3.select(el).selectAll('*').remove();

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
