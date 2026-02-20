export interface EntityPhoto {
  id: number;
  url: string;
  user_id: string;
  entity_id: number;
  caption?: string | null;
  created_at: string;
  photo_id: string;
  tags: string[];
}

export interface EntityPhotosResponse {
  photos: EntityPhoto[];
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

