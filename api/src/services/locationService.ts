import { db } from '../db';

interface UpdateLocationParams {
  city?: string;
  state?: string;
  country?: string;
}

class LocationService {
  private static instance: LocationService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Update last_visited timestamp for cities, states, and countries
   */
  public async updateLocationVisited(params: UpdateLocationParams): Promise<{
    success: boolean;
    updated: boolean;
  }> {
    const { city, state, country } = params;

    if (!country) {
      throw new Error('Country is required for location update.');
    }

    let updated = false;

    // Update city if provided
    if (city) {
      const result = await db.run(
        `UPDATE cities SET last_visited = NOW() WHERE name = $1`,
        [city]
      );

      if (result.rowCount > 0) {
        updated = true;
      }
    }

    // Update state if provided and country is US or Canada
    if (state && (country === 'United States' || country === 'Canada')) {
      const result = await db.run(
        `UPDATE states SET last_visited = NOW() WHERE name = $1`,
        [state]
      );

      if (result.rowCount > 0) {
        updated = true;
      }
    }

    // Update country if provided
    if (country) {
      const result = await db.run(
        `UPDATE countries SET last_visited = NOW() WHERE name = $1`,
        [country]
      );

      if (result.rowCount > 0) {
        updated = true;
      }
    }

    return {
      success: true,
      updated,
    };
  }
}

export const locationService = LocationService.getInstance();

