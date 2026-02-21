export interface State {
  id: number;
  name: string;
  abbr?: string;
  country_id: number;
  country_name?: string;
  last_visited?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
}

export interface StateListResponse {
  states: State[];
  total: number;
  page?: number;
  limit?: number;
}

export interface StateListParams {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: 'name' | 'abbr' | 'country_id' | 'last_visited' | 'country_name';
  sortOrder?: 'asc' | 'desc';
  includeDisabled?: boolean;
}

export interface CreateStateRequest {
  name: string;
  country_id: number;
  abbr?: string;
  last_visited?: string;
}

export interface UpdateStateRequest extends CreateStateRequest {
  id: number;
}

export interface StateResponse {
  id?: number;
  message?: string;
  error?: string;
}

