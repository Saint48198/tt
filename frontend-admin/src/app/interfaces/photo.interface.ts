export interface EntityPhoto {
  id: number;
  url: string;
  user_id: string;
  entity_id: number;
  caption?: string | null;
  created_at: string;
  photo_id: string;
  tags: string[];
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
}

export interface EntityPhotosResponse {
  photos: EntityPhoto[];
}

export interface AdminPhoto {
  id: number | null;
  url: string;
  user_id: string | null;
  caption?: string | null;
  created_at: string;
  photo_id: string;
  city_id: number | null;
  city_name: string | null;
  attraction_id: number | null;
  attraction_name: string | null;
  /** @deprecated Use city_id / attraction_id instead */
  entity_type?: 'cities' | 'attractions' | null;
  /** @deprecated Use city_id / attraction_id instead */
  entity_id?: number | null;
  /** @deprecated Use city_name / attraction_name instead */
  entity_name?: string | null;
  tags: string[];
  source: 'database' | 'cloudinary' | 'both';
  in_database: boolean;
  in_cloudinary: boolean;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
}

export interface AllPhotosResponse {
  photos: AdminPhoto[];
  total: number;
}

export interface UploadedPhoto {
  public_id: string;
  secure_url: string;
  url: string;
  [key: string]: unknown;
}

export interface UploadPhotosResponse {
  success: boolean;
  images: UploadedPhoto[];
}

