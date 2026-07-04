export type WishListType = 'country' | 'city' | 'attraction';

export interface WishListItem {
  id: number;
  user_id: number;
  type: WishListType;
  name: string;
  country_id?: number | null;
  city_id?: number | null;
  attraction_id?: number | null;
  notes?: string | null;
  priority: number;
  created_date?: string;
  updated_date?: string;
  // Joined display fields (read-only)
  country_name?: string | null;
  city_name?: string | null;
  attraction_name?: string | null;
}

export interface CreateWishListItemRequest {
  type: WishListType;
  /** Optional — server derives the canonical name from the chosen country/city/attraction. */
  name?: string;
  country_id?: number | null;
  city_id?: number | null;
  attraction_id?: number | null;
  notes?: string | null;
  priority?: number;
}

export interface UpdateWishListItemRequest {
  type?: WishListType;
  /** Optional — server derives the canonical name when FKs change. */
  name?: string;
  country_id?: number | null;
  city_id?: number | null;
  attraction_id?: number | null;
  notes?: string | null;
  priority?: number;
}
