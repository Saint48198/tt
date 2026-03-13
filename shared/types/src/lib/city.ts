export interface CityAlias {
  id: number;
  city_id: number;
  alias: string;
  created_date?: string;
}

export interface City {
  id: number;
  name: string;
  lat: number;
  lng: number;
  country_id?: number;
  country_name?: string;
  state_id?: number;
  state_name?: string;
  last_visited?: string;
  wiki_term?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  aliases?: CityAlias[];
}

export interface CityListResponse {
  cities: City[];
  total: number;
  page: number;
  limit: number;
}

export interface CityListParams {
  country_id?: number;
  state_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: 'name' | 'lat' | 'lng' | 'country_name' | 'state_name';
  sort?: 'asc' | 'desc';
  includeDisabled?: boolean;
}

export interface CreateCityRequest {
  name: string;
  lat: number;
  lng: number;
  country_id: number;
  state_id?: number;
  last_visited?: string;
  wiki_term?: string;
}

export interface UpdateCityRequest extends CreateCityRequest {
  id: number;
}

export interface CityResponse {
  id?: number;
  message?: string;
  error?: string;
}
