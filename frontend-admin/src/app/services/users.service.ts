import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  User,
  UserListResponse,
  UserListParams,
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/users';

  /**
   * Get paginated list of users with optional sorting
   */
  getUsers(params?: UserListParams): Observable<UserListResponse> {
    let httpParams = new HttpParams();

    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.all) {
      httpParams = httpParams.set('all', 'true');
    }
    if (params?.sortBy) {
      httpParams = httpParams.set('sortBy', params.sortBy);
    }
    if (params?.sortOrder) {
      httpParams = httpParams.set('sortOrder', params.sortOrder);
    }

    return this.http.get<UserListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get all users without pagination
   */
  getAllUsers(sortBy: UserListParams['sortBy'] = 'username'): Observable<UserListResponse> {
    return this.getUsers({ all: true, sortBy });
  }

  /**
   * Get a single user by ID
   */
  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new user
   */
  createUser(request: CreateUserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.apiUrl, request);
  }

  /**
   * Update an existing user
   */
  updateUser(id: number, request: Omit<UpdateUserRequest, 'id'>): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.apiUrl}/${id}`, request);
  }

  /**
   * Delete a user
   */
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

