import axios from 'axios';

interface GeocodeReverseResult {
  city: string;
  state: string;
  country: string;
}

interface GeocodeForwardResult {
  lat: number;
  lng: number;
}

interface ReverseGeocodeParams {
  latitude: number;
  longitude: number;
}

interface ForwardGeocodeParams {
  city?: string;
  country?: string;
  place?: string;
  state?: string;
}

class GeocodeService {
  private static instance: GeocodeService;
  private apiKey: string;

  private constructor() {
    // Private constructor prevents direct instantiation
    this.apiKey = process.env.OPENCAGE_API_KEY || '';
  }

  public static getInstance(): GeocodeService {
    if (!GeocodeService.instance) {
      GeocodeService.instance = new GeocodeService();
    }
    return GeocodeService.instance;
  }

  /**
   * Reverse Geocoding: Convert latitude and longitude to city, state, country
   */
  public async reverseGeocode(params: ReverseGeocodeParams): Promise<GeocodeReverseResult> {
    const { latitude, longitude } = params;

    const response = await axios.get(
      'https://api.opencagedata.com/geocode/v1/json',
      {
        params: {
          q: `${latitude},${longitude}`,
          key: this.apiKey,
        },
      }
    );

    const { results } = response.data;

    if (results.length > 0) {
      const location = results[0].components;

      const cityName =
        location.city || location.town || location.village || 'Unknown City';
      const stateName = location.state || 'Unknown State';
      const countryName = location.country || 'Unknown Country';

      return {
        city: cityName,
        state: stateName,
        country: countryName,
      };
    }

    throw new Error('No results found for the given coordinates.');
  }

  /**
   * Forward Geocoding: Convert city, country, or place to latitude and longitude
   */
  public async forwardGeocode(params: ForwardGeocodeParams): Promise<GeocodeForwardResult> {
    const { city, country, place, state } = params;

    // Validate input
    if ((!city || !country) && !place) {
      throw new Error(
        'At least one of city, country, or place is required.'
      );
    }

    const query =
      place || `${city || ''}, ${state || ''}, ${country || ''}`.trim();

    const response = await axios.get(
      'https://api.opencagedata.com/geocode/v1/json',
      {
        params: {
          q: query,
          key: this.apiKey,
        },
      }
    );

    const { results } = response.data;

    if (results.length > 0) {
      const { lat, lng } = results[0].geometry;
      return { lat, lng };
    }

    throw new Error('No results found for the given city and country.');
  }
}

export const geocodeService = GeocodeService.getInstance();



