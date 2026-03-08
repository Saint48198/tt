import { db } from '../db';

interface PublicCountry {
  country: string;
  lat: number;
  lng: number;
  lastVisited: string | null;
}

interface PublicProfile {
  username: string;
  countries: PublicCountry[];
}

class ProfileService {
  private static instance: ProfileService;
  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  /**
   * Get a user's public profile with visited countries.
   * Countries are derived from photos → cities/attractions → countries.
   */
  public async getPublicProfile(username: string): Promise<PublicProfile | null> {
    // Look up user by username (case-insensitive)
    const user = await db.get<{ id: number; username: string }>(
      'SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) AND disabled_date IS NULL',
      [username]
    );

    if (!user) {
      return null;
    }

    // Get distinct countries from photos via cities and attractions
    const countries = await db.all<PublicCountry>(
      `SELECT DISTINCT
         c.name AS country,
         c.lat,
         c.lng,
         c.last_visited AS "lastVisited"
       FROM photos p
       LEFT JOIN cities ci ON p.city_id = ci.id
       LEFT JOIN attractions a ON p.attraction_id = a.id
       JOIN countries c ON c.id = COALESCE(ci.country_id, a.country_id)
       WHERE p.user_id = $1
         AND c.disabled_date IS NULL
       ORDER BY c.name`,
      [user.id]
    );

    return {
      username: user.username,
      countries,
    };
  }
}

export const profileService = ProfileService.getInstance();
