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

export interface Attraction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  wiki_term?: string;
  country_name?: string;
  country_id?: number;
  state_id?: number | null;
  state_name?: string;
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
  state_id?: number | null;
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
