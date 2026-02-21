import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  State,
  StateListResponse,
  StateListParams,
  CreateStateRequest,
  StateResponse,
} from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class StatesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/states';

  /**
   * Get paginated list of states with optional sorting
   */
  getStates(params?: StateListParams): Observable<StateListResponse> {
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
    if (params?.includeDisabled) {
      httpParams = httpParams.set('includeDisabled', 'true');
    }

    return this.http.get<StateListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Get all states without pagination
   */
  getAllStates(sortBy: StateListParams['sortBy'] = 'name'): Observable<StateListResponse> {
    return this.getStates({ all: true, sortBy });
  }

  /**
   * Get a single state by ID
   */
  getState(id: number): Observable<State> {
    return this.http.get<State>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new state
   */
  createState(state: CreateStateRequest): Observable<StateResponse> {
    return this.http.post<StateResponse>(this.apiUrl, state);
  }

  /**
   * Update an existing state
   */
  updateState(id: number, state: CreateStateRequest): Observable<StateResponse> {
    return this.http.put<StateResponse>(`${this.apiUrl}/${id}`, state);
  }

  /**
   * Delete a state
   */
  deleteState(id: number): Observable<StateResponse> {
    return this.http.delete<StateResponse>(`${this.apiUrl}/${id}`);
  }
}

