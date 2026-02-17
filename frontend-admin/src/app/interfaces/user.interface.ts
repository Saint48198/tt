export interface User {
  id: number;
  username: string;
  email: string;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expiry?: string | null;
  roles?: string | string[];
}

export interface UserListResponse {
  users: User[];
  total: number;
  page?: number;
  limit?: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: 'username' | 'email' | 'id';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  id: number;
  username?: string;
  email?: string;
}

export interface UserResponse {
  id?: number;
  message?: string;
  error?: string;
}

