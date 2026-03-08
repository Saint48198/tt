export interface ReverseGeocodeRequest {
  latitude: number;
  longitude: number;
}

export interface ForwardGeocodeRequest {
  city?: string;
  state?: string;
  country?: string;
  place?: string;
}

export interface ReverseGeocodeResponse {
  city: string;
  state: string;
  country: string;
}

export interface ForwardGeocodeResponse {
  lat: number;
  lng: number;
}
