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
}

interface ListCountriesOptions {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: string;
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
  ];

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): CountryService {
    if (!CountryService.instance) {
      CountryService.instance = new CountryService();
    }
    return CountryService.instance;
  }

  /**
   * Get all countries or paginated countries with sorting
   */
  public getCountries(options: ListCountriesOptions): {
    countries: Country[];
    total: number;
    page?: number;
    limit?: number;
  } {
    const {
      page = 1,
      limit = 10,
      all = false,
      sortBy = 'name',
      sortOrder = 'asc',
    } = options;

    const sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();

    if (!this.validColumns.includes(sortByStr)) {
      throw new Error('Invalid sort column.');
    }

    if (!['asc', 'desc'].includes(sortOrderStr)) {
      throw new Error('Invalid sort order.');
    }

    if (all) {
      const countries = db
        .prepare(
          `SELECT * FROM countries ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`
        )
        .all() as Country[];

      return {
        total: countries.length,
        countries,
      };
    }

    const offset = (page - 1) * limit;

    const totalRow = db
      .prepare('SELECT COUNT(*) AS count FROM countries')
      .get() as { count: number };

    const countries = db
      .prepare(
        `SELECT * FROM countries
         ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Country[];

    return {
      total: totalRow.count,
      countries,
      page,
      limit,
    };
  }

  /**
   * Get a country by ID
   */
  public getCountryById(id: number | string): Country | undefined {
    return db.prepare('SELECT * FROM countries WHERE id = ?').get(id) as Country | undefined;
  }

  /**
   * Create a new country
   */
  public createCountry(data: {
    name: string;
    abbreviation?: string;
    lat?: number;
    lng?: number;
    slug?: string;
    last_visited?: string;
    geo_map_id?: string;
  }): { id: number } {
    const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } =
      data;

    const result = db
      .prepare(
        `INSERT INTO countries
         (name, abbreviation, lat, lng, slug, last_visited, geo_map_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, abbreviation, lat, lng, slug, last_visited, geo_map_id);

    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Update a country
   */
  public updateCountry(
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
  ): { success: boolean; changes: number } {
    const { name, abbreviation, lat, lng, slug, last_visited, geo_map_id } =
      data;

    const result = db
      .prepare(
        'UPDATE countries SET name = ?, abbreviation = ?, lat = ?, lng = ?, slug = ?, last_visited = ?, geo_map_id = ? WHERE id = ?'
      )
      .run(name, abbreviation, lat, lng, slug, last_visited, geo_map_id, id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete a country
   */
  public deleteCountry(id: number | string): { success: boolean; changes: number } {
    const result = db.prepare('DELETE FROM countries WHERE id = ?').run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }
}

export const countryService = CountryService.getInstance();

