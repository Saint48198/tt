export interface CountryAlias {
  id: number;
  country_id: number;
  alias: string;
  created_date?: string;
}

export interface Country {
  id: number;
  name: string;
  abbreviation?: string;
  lat?: number;
  lng?: number;
  slug?: string;
  region?: string;
  sub_region?: string;
  world_region_id?: number | null;
  world_sub_region_id?: number | null;
  world_region_name?: string;
  world_sub_region_name?: string;
  last_visited?: string;
  geo_map_id?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  aliases?: CountryAlias[];
}

export interface CountryListResponse {
  countries: Country[];
  total: number;
  page?: number;
  limit?: number;
}

export interface CountryListParams {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?:
    | 'name'
    | 'abbreviation'
    | 'lat'
    | 'lng'
    | 'slug'
    | 'region'
    | 'sub_region'
    | 'last_visited'
    | 'geo_map_id';
  sortOrder?: 'asc' | 'desc';
  includeDisabled?: boolean;
}

export interface CreateCountryRequest {
  name: string;
  abbreviation?: string;
  lat?: number;
  lng?: number;
  slug?: string;
  region?: string;
  sub_region?: string;
  world_region_id?: number | null;
  world_sub_region_id?: number | null;
  last_visited?: string;
  geo_map_id?: string;
}

export interface UpdateCountryRequest extends CreateCountryRequest {
  id: number;
}

export interface CountryResponse {
  id?: number;
  changes?: number;
  message?: string;
  error?: string;
}

export interface CountryVisited {
  country: string;
  lastVisited: string;
  lat: number;
  lng: number;
}
