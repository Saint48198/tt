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
  public updateLocationVisited(params: UpdateLocationParams): {
    success: boolean;
    updated: boolean;
  } {
    const { city, state, country } = params;

    if (!country) {
      throw new Error('Country is required for location update.');
    }

    let updated = false;

    // Update city if provided
    if (city) {
      const result = db
        .prepare(`
          UPDATE cities
          SET last_visited = datetime('now')
          WHERE name = ?
        `)
        .run(city);

      if (result.changes > 0) {
        updated = true;
      }
    }

    // Update state if provided and country is US or Canada
    if (state && (country === 'United States' || country === 'Canada')) {
      const result = db
        .prepare(`
          UPDATE states
          SET last_visited = datetime('now')
          WHERE name = ?
        `)
        .run(state);

      if (result.changes > 0) {
        updated = true;
      }
    }

    // Update country if provided
    if (country) {
      const result = db
        .prepare(`
          UPDATE countries
          SET last_visited = datetime('now')
          WHERE name = ?
        `)
        .run(country);

      if (result.changes > 0) {
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

