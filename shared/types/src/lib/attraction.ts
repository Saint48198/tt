export interface AttractionAlias {
  id: number;
  attraction_id: number;
  alias: string;
  created_date?: string;
}

export interface AttractionType {
  id: number;
  name: string;
  slug: string;
}

export interface AttractionState {
  id: number;
  name: string;
  abbr?: string;
}

export interface Attraction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  wiki_term?: string;
  country_name?: string;
  country_id?: number;
  /** @deprecated Prefer `states[]`. Populated from the first entry of `states[]`. */
  state_id?: number | null;
  /** @deprecated Prefer `states[]`. Populated from the first entry of `states[]`. */
  state_name?: string;
  /** All states associated with this attraction. */
  states?: AttractionState[];
  types?: AttractionType[];
  last_visited?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  aliases?: AttractionAlias[];
}

export interface AttractionListResponse {
  attractions: Attraction[];
  total: number;
  page: number;
  limit: number;
}

export interface AttractionListParams {
  country_id?: number;
  state_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: 'name' | 'lat' | 'lng' | 'wiki_term' | 'country_name' | 'last_visited' | 'updated_date';
  sortOrder?: 'asc' | 'desc';
  includeDisabled?: boolean;
}

export interface CreateAttractionRequest {
  name: string;
  country_id: number;
  /** @deprecated Prefer `state_ids`. */
  state_id?: number | null;
  /** Multiple states an attraction spans (many-to-many). */
  state_ids?: number[];
  lat: number;
  lng: number;
  type_ids?: number[];
  last_visited?: string;
  wiki_term?: string;
}

export interface UpdateAttractionRequest extends CreateAttractionRequest {
  id: number;
}

export interface AttractionResponse {
  message: string;
  id?: number;
}
