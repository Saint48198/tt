import { db } from '../db';

interface Country {
  id: number;
  name: string;
  abbreviation?: string;
  lat?: number;
  lng?: number;
  slug?: string;
  last_visited?: string;
  geo_map_id?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
}

interface ListCountriesOptions {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: string;
  includeDisabled?: boolean;
}

class CountryService {
  private static instance: CountryService;
  private validColumns = [
    'name',
    'abbreviation',
    'lat',
    'lng',
    'slug',
    'last_visited',
    'geo_map_id',
    'created_date',
    'updated_date',
    'disabled_date',
  ];

  private constructor() {}

  public static getInstance(): CountryService {
    if (!CountryService.instance) {
      CountryService.instance = new CountryService();
    }
    return CountryService.instance;
  }

  public async getCountries(options: ListCountriesOptions): Promise<{
    countries: Country[];
    total: number;
    page?: number;
    limit?: number;
  }> {
    const {
      page = 1,
      limit = 10,
      all = false,
      sortBy = 'name',
      sortOrder = 'asc',
      includeDisabled = false,
    } = options;

    const sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();

    if (!this.validColumns.includes(sortByStr)) {
      throw new Error('Invalid sort column.');
    }
    if (!['asc', 'desc'].includes(sortOrderStr)) {
      throw new Error('Invalid sort order.');
    }

    const disabledFilter = includeDisabled ? '' : 'WHERE disabled_date IS NULL';

    if (all) {
      const countries = await db.all<Country>(
        `SELECT * FROM countries ${disabledFilter} ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`
      );
      return { total: countries.length, countries };
    }

    const offset = (page - 1) * limit;
    const totalRow = await db.get<{ count: string }>(
      `SELECT COUNT(*) AS count FROM countries ${disabledFilter}`
    );
    const countries = await db.all<Country>(
      `SELECT * FROM countries ${disabledFilter} ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return { total: Number(totalRow?.count ?? 0), countries, page, limit };
  }

  public async getCountryById(id: number | string): Promise<Country | undefined> {
    return db.get<Country>('SELECT * FROM countries WHERE id = $1 AND disabled_date IS NULL', [id]);
  }

  public async createCountry(data: {
    name: string;
    abbreviation?: string;
    lat?: number;
    lng?: number;
    slug?: string;
    last_visited?: string;
    geo_map_id?: string;
  }): Promise<{ id: number }> {
    const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } = data;
    const result = await db.run(
      `INSERT INTO countries (name, abbreviation, lat, lng, slug, last_visited, geo_map_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, abbreviation, lat, lng, slug, last_visited, geo_map_id]
    );
    return { id: result.rows[0].id };
  }

  public async updateCountry(
    id: number | string,
    data: {
      name?: string;
      abbreviation?: string;
      lat?: number;
      lng?: number;
      slug?: string;
      last_visited?: string;
      geo_map_id?: string;
    }
  ): Promise<{ success: boolean; changes: number }> {
    const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } = data;
    const result = await db.run(
      'UPDATE countries SET name = $1, abbreviation = $2, lat = $3, lng = $4, slug = $5, last_visited = $6, geo_map_id = $7, updated_date = NOW() WHERE id = $8',
      [name, abbreviation, lat, lng, slug, last_visited, geo_map_id, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async deleteCountry(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run(
      'UPDATE countries SET disabled_date = NOW() WHERE id = $1 AND disabled_date IS NULL',
      [id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Get all visited countries for a specific user.
   * Includes countries with a last_visited date AND countries linked via the user's photos.
   */
  public async getVisitedCountries(userId: number): Promise<Country[]> {
    return db.all<Country>(
      `SELECT * FROM countries
       WHERE disabled_date IS NULL
         AND id IN (
           -- Countries with a last_visited date
           SELECT id FROM countries WHERE last_visited IS NOT NULL
           UNION
           -- Countries linked through user's photos via cities
           SELECT ci.country_id FROM photos p
             JOIN cities ci ON p.city_id = ci.id
             WHERE p.user_id = $1 AND ci.country_id IS NOT NULL
           UNION
           -- Countries linked through user's photos via attractions
           SELECT a.country_id FROM photos p
             JOIN attractions a ON p.attraction_id = a.id
             WHERE p.user_id = $1 AND a.country_id IS NOT NULL
         )
       ORDER BY last_visited DESC`,
      [userId]
    );
  }
}

export const countryService = CountryService.getInstance();
