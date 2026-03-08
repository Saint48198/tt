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
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'TripTracker/1.0';

  private constructor() {
    // Private constructor prevents direct instantiation
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

    const response = await axios.get(`${this.nominatimUrl}/reverse`, {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1,
      },
      headers: {
        'User-Agent': this.userAgent,
        'Accept-Language': 'en',
      },
    });

    const address = response.data?.address;

    if (address) {
      const cityName =
        address.city || address.town || address.village || address.municipality || 'Unknown City';
      const stateName = address.state || 'Unknown State';
      const countryName = address.country || 'Unknown Country';

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

    // Validate input — need at least one of city, country, or place
    if (!city && !country && !place) {
      throw new Error('At least one of city, country, or place is required.');
    }

    const query = place || [city, state, country].filter(Boolean).join(', ');

    const response = await axios.get(`${this.nominatimUrl}/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': this.userAgent,
        'Accept-Language': 'en',
      },
    });

    const results = response.data;

    if (results && results.length > 0) {
      const { lat, lon } = results[0];
      return { lat: parseFloat(lat), lng: parseFloat(lon) };
    }

    throw new Error('No results found for the given query.');
  }
}

export const geocodeService = GeocodeService.getInstance();
