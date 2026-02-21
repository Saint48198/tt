export interface Attraction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  wiki_term?: string;
  country_name?: string;
  country_id?: number;
  is_unesco?: boolean;
  is_national_park?: boolean;
  last_visited?: string;
}

export interface AttractionListResponse {
  attractions: Attraction[];
  total: number;
  page: number;
  limit: number;
}

export interface AttractionListParams {
  country_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'lat' | 'lng' | 'wiki_term' | 'country_name';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateAttractionRequest {
  name: string;
  country_id: number;
  lat: number;
  lng: number;
  is_unesco?: boolean;
  is_national_park?: boolean;
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

