import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  afterNextRender,
  Injector,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { filter, switchMap, catchError } from 'rxjs/operators';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PhotosService } from '../../services/photos.service';
import { CountriesService } from '../../services/countries.service';
import { StatesService } from '../../services/states.service';
import { CitiesService } from '../../services/cities.service';
import { AttractionsService } from '../../services/attractions.service';
import { AdminPhoto } from '@shared/types';
import {
  PhotoEditDialogComponent,
  PhotoEditDialogResult,
} from '../../components/photo-edit-dialog/photo-edit-dialog.component';
import {
  BulkUploadDialogComponent,
  BulkUploadDialogResult,
} from '../../components/bulk-upload-dialog/bulk-upload-dialog.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { ImageLoaderComponent } from '@shared/components';

@Component({
  selector: 'app-photos-list',
  imports: [
    DatePipe,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    ImageLoaderComponent,
    DecimalPipe,
  ],
  templateUrl: './photos-list.component.html',
  styleUrl: './photos-list.component.scss',
})
export class PhotosListComponent implements OnInit, AfterViewInit {
  private readonly photosService = inject(PhotosService);
  private readonly countriesService = inject(CountriesService);
  private readonly statesService = inject(StatesService);
  private readonly citiesService = inject(CitiesService);
  private readonly attractionsService = inject(AttractionsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  photos = signal<AdminPhoto[]>([]);
  total = signal(0);
  loading = signal(false);
  loadingMore = signal(false);
  viewMode = signal<'masonry' | 'list'>('masonry');

  // Individual entity filters
  countryFilter = signal<number | null>(null);
  stateFilter = signal<number | null>(null);
  cityFilter = signal<number | null>(null);
  attractionFilter = signal<number | null>(null);
  unassignedFilter = signal(false);
  tagsFilter = signal(false);
  dateSortOrder = signal<'asc' | 'desc'>('desc');
  dateSortField = signal<'created_date' | 'updated_date' | 'created_at'>('created_at');

  // Entity option lists
  countryOptions = signal<Array<{ id: number; name: string }>>([]);
  stateOptions = signal<Array<{ id: number; name: string }>>([]);
  cityOptions = signal<Array<{ id: number; name: string }>>([]);
  attractionOptions = signal<Array<{ id: number; name: string }>>([]);
  loadingCountries = signal(false);
  loadingStates = signal(false);
  loadingCities = signal(false);
  loadingAttractions = signal(false);

  // Determine the active entity filter to pass to the API
  private get activeEntityType(): string | undefined {
    if (this.unassignedFilter()) return 'unassigned';
    if (this.attractionFilter()) return 'attraction';
    if (this.cityFilter()) return 'city';
    if (this.stateFilter()) return 'state';
    if (this.countryFilter()) return 'country';
    return undefined;
  }

  private get activeEntityId(): number | undefined {
    return (
      this.attractionFilter() ??
      this.cityFilter() ??
      this.stateFilter() ??
      this.countryFilter() ??
      undefined
    );
  }

  // Client-side filtered photos (ensures noTags filter always works)
  filteredPhotos = computed(() => {
    const all = this.photos();
    if (this.tagsFilter()) {
      return all.filter((p) => !p.tags || p.tags.length === 0);
    }
    return all;
  });

  // Infinite scroll state
  private currentPage = 1;
  private readonly pageSize = 50;
  hasMore = signal(true);
  private scrollObserver: IntersectionObserver | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    // Restore filters from URL
    const country = params.get('country');
    if (country) this.countryFilter.set(+country);
    const state = params.get('state');
    if (state) this.stateFilter.set(+state);
    const city = params.get('city');
    if (city) this.cityFilter.set(+city);
    const attraction = params.get('attraction');
    if (attraction) this.attractionFilter.set(+attraction);
    if (params.get('unassigned') === '1') this.unassignedFilter.set(true);
    if (params.get('noTags') === '1') this.tagsFilter.set(true);
    const sortBy = params.get('sortBy');
    if (sortBy === 'created_date' || sortBy === 'updated_date' || sortBy === 'created_at') {
      this.dateSortField.set(sortBy);
    }
    const sortOrder = params.get('sortOrder');
    if (sortOrder === 'asc' || sortOrder === 'desc') {
      this.dateSortOrder.set(sortOrder);
    }
    const view = params.get('view');
    if (view === 'masonry' || view === 'list') {
      this.viewMode.set(view);
    }

    const pageParam = params.get('page');
    const initialPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

    if (initialPage > 1) {
      this.loadPhotosUpToPage(initialPage);
    } else {
      this.loadPhotos();
    }
    this.loadAllEntityOptions();
  }

  ngAfterViewInit(): void {
    this.setupScrollObserver();
    this.destroyRef.onDestroy(() => this.scrollObserver?.disconnect());

    // Sync paginator with the initial page from URL
    if (this.paginator && this.currentPage > 1) {
      this.paginator.pageIndex = this.currentPage - 1;
    }
  }

  private setupScrollObserver(): void {
    this.scrollObserver?.disconnect();

    // Defer observer setup until after the next render cycle so the
    // conditionally-rendered scroll sentinel element is in the DOM.
    afterNextRender(
      () => {
        if (!this.scrollSentinel?.nativeElement) return;

        this.scrollObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (
              entry.isIntersecting &&
              this.viewMode() === 'masonry' &&
              !this.loading() &&
              !this.loadingMore() &&
              this.hasMore()
            ) {
              this.loadMorePhotos();
            }
          },
          { rootMargin: '200px' }
        );

        this.scrollObserver.observe(this.scrollSentinel.nativeElement);
      },
      { injector: this.injector }
    );
  }

  /** Sync all filter state and page number to URL query params */
  private updateUrlParams(): void {
    const page = this.currentPage;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: page > 1 ? page : null,
        country: this.countryFilter() || null,
        state: this.stateFilter() || null,
        city: this.cityFilter() || null,
        attraction: this.attractionFilter() || null,
        unassigned: this.unassignedFilter() ? '1' : null,
        noTags: this.tagsFilter() ? '1' : null,
        sortBy: this.dateSortField() !== 'created_at' ? this.dateSortField() : null,
        sortOrder: this.dateSortOrder() !== 'desc' ? this.dateSortOrder() : null,
        view: this.viewMode() !== 'masonry' ? this.viewMode() : null,
      },
      replaceUrl: true,
    });
  }

  /** Load all pages from 1..targetPage to restore masonry scroll position */
  private loadPhotosUpToPage(targetPage: number): void {
    this.loading.set(true);
    const limit = this.pageSize;

    this.photosService
      .getAllPhotos({
        page: 1,
        limit: limit * targetPage,
        entityType: this.activeEntityType,
        entityId: this.activeEntityId,
        noTags: this.tagsFilter(),
        sortBy: this.dateSortField(),
        sortOrder: this.dateSortOrder(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.currentPage = targetPage;
          this.updateUrlParams();
          this.photos.set(response.photos);
          this.total.set(response.total);
          this.hasMore.set(response.photos.length < response.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to load photos', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
        },
      });
  }

  loadPhotos(page = 1, limit = this.pageSize): void {
    this.loading.set(true);
    this.currentPage = page;
    this.updateUrlParams();

    this.photosService
      .getAllPhotos({
        page,
        limit,
        entityType: this.activeEntityType,
        entityId: this.activeEntityId,
        noTags: this.tagsFilter(),
        sortBy: this.dateSortField(),
        sortOrder: this.dateSortOrder(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.photos.set(response.photos);
          this.total.set(response.total);
          this.hasMore.set(
            response.photos.length >= this.pageSize && response.photos.length < response.total
          );
          this.loading.set(false);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to load photos', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading.set(false);
        },
      });
  }

  private loadMorePhotos(): void {
    this.loadingMore.set(true);
    const nextPage = this.currentPage + 1;

    this.photosService
      .getAllPhotos({
        page: nextPage,
        limit: this.pageSize,
        entityType: this.activeEntityType,
        entityId: this.activeEntityId,
        noTags: this.tagsFilter(),
        sortBy: this.dateSortField(),
        sortOrder: this.dateSortOrder(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.currentPage = nextPage;
          this.updateUrlParams();
          this.photos.update((current) => [...current, ...response.photos]);
          this.total.set(response.total);
          this.hasMore.set(
            response.photos.length >= this.pageSize && this.photos().length < response.total
          );
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.loadPhotos();
  }

  onCountryChange(id: number | null): void {
    this.countryFilter.set(id);
    this.onFilterChange();
  }

  onStateChange(id: number | null): void {
    this.stateFilter.set(id);
    this.onFilterChange();
  }

  onCityChange(id: number | null): void {
    this.cityFilter.set(id);
    this.onFilterChange();
  }

  onAttractionChange(id: number | null): void {
    this.attractionFilter.set(id);
    this.onFilterChange();
  }

  onUnassignedChange(checked: boolean): void {
    this.unassignedFilter.set(checked);
    // Clear other filters when showing unassigned
    if (checked) {
      this.countryFilter.set(null);
      this.stateFilter.set(null);
      this.cityFilter.set(null);
      this.attractionFilter.set(null);
    }
    this.onFilterChange();
  }

  toggleDateSort(): void {
    this.dateSortOrder.update((current) => (current === 'asc' ? 'desc' : 'asc'));
    this.onFilterChange();
  }

  onViewModeChange(mode: 'masonry' | 'list'): void {
    this.viewMode.set(mode);
    this.updateUrlParams();
  }

  clearFilters(): void {
    this.countryFilter.set(null);
    this.stateFilter.set(null);
    this.cityFilter.set(null);
    this.attractionFilter.set(null);
    this.unassignedFilter.set(false);
    this.tagsFilter.set(false);
    this.onFilterChange();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.countryFilter() ||
      this.stateFilter() ||
      this.cityFilter() ||
      this.attractionFilter() ||
      this.unassignedFilter() ||
      this.tagsFilter()
    );
  }

  private loadAllEntityOptions(): void {
    this.loadingCountries.set(true);
    this.countriesService
      .getAllCountries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.countryOptions.set(res.countries.map((c) => ({ id: c.id, name: c.name })));
          this.loadingCountries.set(false);
        },
        error: () => this.loadingCountries.set(false),
      });

    this.loadingStates.set(true);
    this.statesService
      .getAllStates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.stateOptions.set(
            res.states.map((s) => ({
              id: s.id,
              name: `${s.name}${s.country_name ? ' (' + s.country_name + ')' : ''}`,
            }))
          );
          this.loadingStates.set(false);
        },
        error: () => this.loadingStates.set(false),
      });

    this.loadingCities.set(true);
    this.citiesService
      .getAllCities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.cityOptions.set(
            res.cities.map((c) => ({
              id: c.id,
              name: `${c.name}${c.country_name ? ' (' + c.country_name + ')' : ''}`,
            }))
          );
          this.loadingCities.set(false);
        },
        error: () => this.loadingCities.set(false),
      });

    this.loadingAttractions.set(true);
    this.attractionsService
      .getAllAttractions('name')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.attractionOptions.set(
            res.attractions.map((a) => ({
              id: a.id,
              name: `${a.name}${a.country_name ? ' (' + a.country_name + ')' : ''}`,
            }))
          );
          this.loadingAttractions.set(false);
        },
        error: () => this.loadingAttractions.set(false),
      });
  }

  onPageChange(event: PageEvent): void {
    this.loadPhotos(event.pageIndex + 1, event.pageSize);
  }

  deletePhoto(photo: AdminPhoto): void {
    if (!photo.in_database || photo.id == null) {
      this.snackBar.open('Cannot delete: photo is not in the database', 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
      return;
    }

    const photoId = photo.id;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete Photo',
          message: 'Are you sure you want to delete this photo?',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          icon: 'delete',
          color: 'warn',
        },
        width: '420px',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          const entityType = photo.city_id
            ? ('cities' as const)
            : photo.attraction_id
              ? ('attractions' as const)
              : null;
          const entityId = photo.city_id || photo.attraction_id;

          return entityType && entityId
            ? this.photosService.deletePhoto(entityType, entityId, photoId)
            : this.photosService.deletePhotoById(photoId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Photo deleted successfully', 'Close', {
            duration: 3000,
          });
          this.photos.update((list) => list.filter((p) => p.id !== photoId));
          this.total.update((t) => t - 1);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Failed to delete photo', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
        },
      });
  }

  openEditDialog(photo: AdminPhoto): void {
    const dialogRef = this.dialog.open(PhotoEditDialogComponent, {
      data: { photo },
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: PhotoEditDialogResult | undefined) => {
        if (result?.updated) {
          // Reload from page 1 to refresh data
          this.loadPhotos();
        }
      });
  }

  openUploadDialog(): void {
    const dialogRef = this.dialog.open(BulkUploadDialogComponent, {
      data: { showCountrySelect: true },
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(
        filter(
          (result): result is BulkUploadDialogResult =>
            !!(result?.uploaded && result.images?.length)
        ),
        switchMap((result: BulkUploadDialogResult) => {
          const countryId = result.country_id ?? null;
          const saveRequests = result.images!.map((img) =>
            this.photosService
              .addPhotoToDb({
                photo_id: img.public_id,
                url: img.secure_url || img.url,
                caption: img.exif?.title || null,
                tags: img.exif?.keywords || [],
                latitude: img.exif?.latitude ?? null,
                longitude: img.exif?.longitude ?? null,
                country_id: countryId,
                created_date: img.exif?.created_date || null,
                original_filename: img.original_filename || null,
              })
              .pipe(
                catchError((err) =>
                  of({ duplicate: true, filename: img.original_filename, error: err?.error?.error })
                )
              )
          );
          return forkJoin(saveRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (results) => {
          const duplicates = results.filter(
            (r): r is { duplicate: boolean; filename: string; error: string } =>
              r !== null && typeof r === 'object' && 'duplicate' in r
          );
          if (duplicates.length > 0) {
            const names = duplicates
              .map((d) => d.filename)
              .filter(Boolean)
              .join(', ');
            this.snackBar.open(
              `${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} skipped${names ? ': ' + names : ''}`,
              'Close',
              { duration: 6000 }
            );
          }
          this.loadPhotos();
        },
        error: () => this.loadPhotos(),
      });
  }
}
