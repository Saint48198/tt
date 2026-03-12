export interface EntityPhoto {
  id: number;
  url: string;
  user_id?: string;
  entity_id?: number;
  caption?: string | null;
  created_at: string;
  photo_id: string;
  tags: string[];
  latitude?: number | null;
  longitude?: number | null;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
}

export interface EntityPhotosResponse {
  photos: EntityPhoto[];
  total: number;
  page: number;
  limit: number;
}

export interface MapPhoto {
  id: number;
  url: string;
  caption: string | null;
  latitude: number;
  longitude: number;
  city_name: string | null;
  attraction_name: string | null;
  country_name: string | null;
  state_name: string | null;
  photo_id: string | null;
  created_at: string;
}

export interface MapPhotosResponse {
  photos: MapPhoto[];
  entityName?: string;
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
  state_id: number | null;
  state_name: string | null;
  country_id: number | null;
  country_name: string | null;
  /** @deprecated Use city_id / attraction_id instead */
  entity_type?: 'cities' | 'attractions' | null;
  /** @deprecated Use city_id / attraction_id instead */
  entity_id?: number | null;
  /** @deprecated Use city_name / attraction_name instead */
  entity_name?: string | null;
  tags: string[];
  latitude?: number | null;
  longitude?: number | null;
  source: 'database' | 'cloudinary' | 'both';
  in_database: boolean;
  in_cloudinary: boolean;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  original_filename?: string | null;
}

export interface AllPhotosResponse {
  photos: AdminPhoto[];
  total: number;
}

export interface ExifMetadata {
  title?: string;
  keywords?: string[];
  latitude?: number;
  longitude?: number;
  created_date?: string;
}

export interface UploadedPhoto {
  public_id: string;
  secure_url: string;
  url: string;
  exif?: ExifMetadata;
  [key: string]: unknown;
}

export interface UploadPhotosResponse {
  success: boolean;
  images: UploadedPhoto[];
}
