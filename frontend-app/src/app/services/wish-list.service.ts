import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  WishListItem,
  WishListType,
  CreateWishListItemRequest,
  UpdateWishListItemRequest,
} from '@shared/types';

export type { WishListItem, WishListType } from '@shared/types';

@Injectable({ providedIn: 'root' })
export class WishListService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/wish-list';

  getAll(type?: WishListType): Observable<WishListItem[]> {
    const url = type ? `${this.apiUrl}?type=${encodeURIComponent(type)}` : this.apiUrl;
    return this.http.get<WishListItem[]>(url);
  }

  get(id: number): Observable<WishListItem> {
    return this.http.get<WishListItem>(`${this.apiUrl}/${id}`);
  }

  create(item: CreateWishListItemRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.apiUrl, item);
  }

  update(id: number, item: UpdateWishListItemRequest): Observable<{ changes: number }> {
    return this.http.put<{ changes: number }>(`${this.apiUrl}/${id}`, item);
  }

  remove(id: number): Observable<{ changes: number }> {
    return this.http.delete<{ changes: number }>(`${this.apiUrl}/${id}`);
  }
}
