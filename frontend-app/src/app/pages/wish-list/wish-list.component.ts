import { Component, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { Country } from '@shared/types';
import { WishListItem, WishListService, WishListType } from '../../services/wish-list.service';
import { AttractionLookup, CityLookup, LookupService } from '../../services/lookup.service';

type FilterType = 'all' | WishListType;

@Component({
  standalone: true,
  selector: 'app-wish-list',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatAutocompleteModule,
    MatButtonModule,
  ],
  templateUrl: './wish-list.component.html',
  styleUrl: './wish-list.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class WishListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private wishListService = inject(WishListService);
  private lookup = inject(LookupService);

  username = signal<string>('');
  items = signal<WishListItem[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  filter = signal<FilterType>('all');

  // form state
  showForm = signal(false);
  editingId = signal<number | null>(null);
  formType = signal<WishListType>('country');
  formCountryId = signal<number | null>(null);
  formCountryQuery = signal('');
  formCityId = signal<number | null>(null);
  formCityLabel = signal('');
  formAttractionId = signal<number | null>(null);
  formAttractionLabel = signal('');
  formNotes = signal('');
  formPriority = signal<number>(0);

  // lookups
  countries = signal<Country[]>([]);
  filteredCountries = signal<Country[]>([]);
  citySuggestions = signal<CityLookup[]>([]);
  attractionSuggestions = signal<AttractionLookup[]>([]);

  private cityQuery$ = new Subject<{ q: string; countryId: number | null }>();
  private attractionQuery$ = new Subject<{ q: string; countryId: number | null }>();
  private countryQuery$ = new Subject<string>();

  readonly typeOptions: { value: WishListType; label: string; icon: string }[] = [
    { value: 'country', label: 'Country', icon: '🌍' },
    { value: 'city', label: 'City', icon: '🏙️' },
    { value: 'attraction', label: 'Attraction', icon: '📍' },
  ];

  readonly filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'country', label: 'Countries' },
    { value: 'city', label: 'Cities' },
    { value: 'attraction', label: 'Attractions' },
  ];

  filteredItems = computed(() => {
    const f = this.filter();
    const all = this.items();
    if (f === 'all') return all;
    return all.filter((i) => i.type === f);
  });

  counts = computed(() => {
    const all = this.items();
    return {
      all: all.length,
      country: all.filter((i) => i.type === 'country').length,
      city: all.filter((i) => i.type === 'city').length,
      attraction: all.filter((i) => i.type === 'attraction').length,
    };
  });

  formValid = computed(() => {
    const t = this.formType();
    if (t === 'country') return this.formCountryId() != null;
    if (t === 'city') return this.formCityId() != null;
    return this.formAttractionId() != null;
  });

  ngOnInit(): void {
    this.username.set(this.route.snapshot.paramMap.get('username') ?? '');
    this.loadCountries();
    this.wireTypeaheads();
    this.wireCountrySearch();

    // Load list, then react to route changes to open/close the form.
    this.load(() => this.syncFormFromRoute());

    // React to future navigations (e.g. clicking Add or the browser back button).
    this.route.url.subscribe(() => this.syncFormFromRoute());
    this.route.paramMap.subscribe(() => this.syncFormFromRoute());
  }

  /** Open / close the form based on the current route. */
  private syncFormFromRoute(): void {
    const mode = this.route.snapshot.data?.['mode'] as 'add' | 'edit' | undefined;

    if (mode === 'add') {
      this.resetForm();
      this.showForm.set(true);
      return;
    }

    if (mode === 'edit') {
      const idStr = this.route.snapshot.paramMap.get('id');
      const id = idStr ? Number(idStr) : NaN;
      const item = this.items().find((i) => i.id === id);
      if (item) {
        this.populateFormFromItem(item);
        this.showForm.set(true);
      } else {
        // Item not loaded yet or not found — fall back to list.
        this.showForm.set(false);
      }
      return;
    }

    this.showForm.set(false);
  }

  /** Base URL for wish-list, preserving the username segment. */
  private wishListBaseUrl(): string {
    return `/${this.username()}/wish-list`;
  }

  private wireCountrySearch(): void {
    this.countryQuery$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        map((q) => this.filterCountries(q))
      )
      .subscribe((filtered) => this.filteredCountries.set(filtered));
  }

  private filterCountries(query: string): Country[] {
    if (!query) return this.countries();
    const lq = query.toLowerCase();
    return this.countries().filter(
      (c) => c.name.toLowerCase().includes(lq) || c.abbreviation?.toLowerCase().includes(lq)
    );
  }

  private wireTypeaheads(): void {
    this.cityQuery$
      .pipe(
        debounceTime(250),
        distinctUntilChanged((a, b) => a.q === b.q && a.countryId === b.countryId),
        switchMap(({ q, countryId }): Observable<CityLookup[]> => {
          if (!q || q.length < 2) return of([]);
          return this.lookup.searchCities(q, countryId).pipe(catchError(() => of([])));
        })
      )
      .subscribe((rows) => this.citySuggestions.set(rows));

    this.attractionQuery$
      .pipe(
        debounceTime(250),
        distinctUntilChanged((a, b) => a.q === b.q && a.countryId === b.countryId),
        switchMap(({ q, countryId }): Observable<AttractionLookup[]> => {
          if (!q || q.length < 2) return of([]);
          return this.lookup.searchAttractions(q, countryId).pipe(catchError(() => of([])));
        })
      )
      .subscribe((rows) => this.attractionSuggestions.set(rows));
  }

  private loadCountries(): void {
    this.lookup.listAllCountries().subscribe({
      next: (rows) => {
        this.countries.set(rows);
        this.filteredCountries.set(rows);
      },
      error: (err) => console.error('Failed to load countries', err),
    });
  }

  load(after?: () => void): void {
    this.loading.set(true);
    this.error.set(null);
    this.wishListService.getAll().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
        after?.();
      },
      error: (err) => {
        console.error('Failed to load wish list', err);
        if (err?.status === 401 || err?.status === 404) {
          this.items.set([]);
        } else {
          this.error.set('Failed to load wish list. Please try again.');
        }
        this.loading.set(false);
        after?.();
      },
    });
  }

  openAddForm(): void {
    this.router.navigateByUrl(`${this.wishListBaseUrl()}/add`);
  }

  openEditForm(item: WishListItem): void {
    this.router.navigateByUrl(`${this.wishListBaseUrl()}/${item.id}/edit`);
  }

  /** Populate form signals from an existing wish item. */
  private populateFormFromItem(item: WishListItem): void {
    this.editingId.set(item.id);
    this.formType.set(item.type);
    this.formCountryId.set(item.country_id ?? null);
    this.formCountryQuery.set(item.country_name ? item.country_name : '');
    this.formCityId.set(item.city_id ?? null);
    this.formCityLabel.set(item.city_name ?? (item.type === 'city' ? item.name : ''));
    this.formAttractionId.set(item.attraction_id ?? null);
    this.formAttractionLabel.set(
      item.attraction_name ?? (item.type === 'attraction' ? item.name : '')
    );
    this.formNotes.set(item.notes ?? '');
    this.formPriority.set(item.priority ?? 0);
    this.citySuggestions.set([]);
    this.attractionSuggestions.set([]);
  }

  cancelForm(): void {
    this.resetForm();
    this.router.navigateByUrl(this.wishListBaseUrl());
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.formType.set('country');
    this.formCountryId.set(null);
    this.formCountryQuery.set('');
    this.formCityId.set(null);
    this.formCityLabel.set('');
    this.formAttractionId.set(null);
    this.formAttractionLabel.set('');
    this.formNotes.set('');
    this.formPriority.set(0);
    this.citySuggestions.set([]);
    this.attractionSuggestions.set([]);
  }

  onTypeChange(t: WishListType): void {
    this.formType.set(t);
    if (t !== 'city') {
      this.formCityId.set(null);
      this.formCityLabel.set('');
      this.citySuggestions.set([]);
    }
    if (t !== 'attraction') {
      this.formAttractionId.set(null);
      this.formAttractionLabel.set('');
      this.attractionSuggestions.set([]);
    }
  }

  onCountryChange(idStr: string | null): void {
    const id = idStr ? Number(idStr) : null;
    this.formCountryId.set(id);
    if (this.formType() === 'city') {
      this.formCityId.set(null);
      this.formCityLabel.set('');
      this.citySuggestions.set([]);
    }
    if (this.formType() === 'attraction') {
      this.formAttractionId.set(null);
      this.formAttractionLabel.set('');
      this.attractionSuggestions.set([]);
    }
  }

  onCountryQueryChange(q: string): void {
    this.formCountryQuery.set(q);
    this.countryQuery$.next(q);
  }

  onCityQueryChange(q: string): void {
    this.formCityLabel.set(q);
    this.formCityId.set(null);
    this.cityQuery$.next({ q, countryId: this.formCountryId() });
  }

  pickCity(city: CityLookup): void {
    this.formCityId.set(city.id);
    this.formCityLabel.set(city.name);
    if (city.country_id) this.formCountryId.set(city.country_id);
    this.citySuggestions.set([]);
  }

  onAttractionQueryChange(q: string): void {
    this.formAttractionLabel.set(q);
    this.formAttractionId.set(null);
    this.attractionQuery$.next({ q, countryId: this.formCountryId() });
  }

  pickAttraction(a: AttractionLookup): void {
    this.formAttractionId.set(a.id);
    this.formAttractionLabel.set(a.name);
    if (a.country_id) this.formCountryId.set(a.country_id);
    this.attractionSuggestions.set([]);
  }

  submitForm(): void {
    if (!this.formValid()) {
      this.error.set('Please pick an existing entry to add to your wish list.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const t = this.formType();
    const payload = {
      type: t,
      country_id: this.formCountryId(),
      city_id: t === 'city' ? this.formCityId() : null,
      attraction_id: t === 'attraction' ? this.formAttractionId() : null,
      notes: this.formNotes().trim() || null,
      priority: Number(this.formPriority()) || 0,
    };

    const editId = this.editingId();
    const obs$: Observable<{ id?: number; changes?: number }> = editId
      ? this.wishListService.update(editId, payload)
      : this.wishListService.create(payload);

    obs$.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.router.navigateByUrl(this.wishListBaseUrl());
        this.load();
      },
      error: (err) => {
        console.error('Failed to save wish list item', err);
        this.error.set(err?.error?.error || 'Failed to save. Please try again.');
        this.saving.set(false);
      },
    });
  }

  deleteItem(item: WishListItem): void {
    if (!confirm(`Remove "${item.name}" from your wish list?`)) return;
    this.wishListService.remove(item.id).subscribe({
      next: () => this.load(),
      error: (err) => {
        console.error('Failed to delete wish list item', err);
        this.error.set('Failed to delete. Please try again.');
      },
    });
  }

  iconForType(type: WishListType): string {
    return this.typeOptions.find((t) => t.value === type)?.icon ?? '⭐';
  }

  labelForType(type: WishListType): string {
    return this.typeOptions.find((t) => t.value === type)?.label ?? type;
  }

  contextLine(item: WishListItem): string {
    if (item.type === 'country') return '';
    return item.country_name ? `in ${item.country_name}` : '';
  }
}
