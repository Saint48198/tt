import { db } from '../db';

interface City {
  id: number;
  name: string;
  lat: number;
  lng: number;
  last_visited?: string;
  country_id: number;
  country_name: string;
  state_id?: number;
  state_name?: string;
  wiki_term?: string;
}

interface ListCitiesOptions {
  country_id?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sort?: string;
}

class CityService {
  private static instance: CityService;
  private validColumns = [
    'cities.name',
    'lat',
    'lng',
    'country_name',
    'state_name',
  ];

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): CityService {
    if (!CityService.instance) {
      CityService.instance = new CityService();
    }
    return CityService.instance;
  }

  /**
   * Get all cities with pagination and sorting
   */
  public getCities(options: ListCitiesOptions): {
    cities: City[];
    total: number;
    page: number;
    limit: number;
  } {
    const {
      country_id,
      page = 1,
      limit = 25,
      sortBy = 'cities.name',
      sort = 'asc',
    } = options;

    const offset = (page - 1) * limit;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sort.toString().toLowerCase();

    if (sortByStr === 'name') {
      sortByStr = 'cities.name';
    }

    if (sortByStr && !this.validColumns.includes(sortByStr)) {
      throw new Error('Invalid sort column.');
    }

    if (!['asc', 'desc'].includes(sortOrderStr)) {
      throw new Error('Invalid sort order.');
    }

    let query = `
      SELECT
        cities.id,
        cities.name,
        cities.lat,
        cities.lng,
        cities.last_visited,
        countries.name AS country_name,
        states.name AS state_name
      FROM cities
      JOIN countries ON cities.country_id = countries.id
      LEFT JOIN states ON cities.state_id = states.id
    `;

    const params: (string | number)[] = [];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      query += ` WHERE cities.country_id = ?`;
      params.push(country_id);
    }

    query += ` ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const cities = db.prepare(query).all(...params) as City[];

    let countQuery = `SELECT COUNT(*) as total FROM cities`;
    const countParams: (string | number)[] = [];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countQuery += ` WHERE country_id = ?`;
      countParams.push(country_id);
    }

    const totalRow = db.prepare(countQuery).get(...countParams) as { total: number };

    return {
      cities,
      total: totalRow.total,
      page,
      limit,
    };
  }

  /**
   * Get a city by ID
   */
  public getCityById(id: number | string): City | undefined {
    return db
      .prepare(
        `SELECT cities.id, cities.name, cities.lat, cities.lng, cities.last_visited,
                cities.country_id AS country_id,
                countries.name AS country_name,
                cities.state_id AS state_id,
                states.name AS state_name,
                cities.wiki_term
         FROM cities
         LEFT JOIN countries ON cities.country_id = countries.id
         LEFT JOIN states ON cities.state_id = states.id
         WHERE cities.id = ?`
      )
      .get(id) as City | undefined;
  }

  /**
   * Create a new city
   */
  public createCity(data: {
    name: string;
    lat: number;
    lng: number;
    state_id?: number;
    country_id: number;
    last_visited?: string;
    wiki_term?: string;
  }): { id: number } {
    const { name, lat, lng, state_id, country_id, last_visited, wiki_term } =
      data;

    const result = db
      .prepare(
        'INSERT INTO cities (name, lat, lng, state_id, country_id, last_visited, wiki_term) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        name,
        lat,
        lng,
        state_id || null,
        country_id,
        last_visited,
        wiki_term
      );

    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Update a city
   */
  public updateCity(
    id: number | string,
    data: {
      name: string;
      lat: number;
      lng: number;
      state_id?: number;
      country_id: number;
      last_visited?: string;
      wiki_term?: string;
    }
  ): { success: boolean; changes: number } {
    const { name, lat, lng, state_id, country_id, last_visited, wiki_term } =
      data;

    const result = db
      .prepare(
        'UPDATE cities SET name = ?, lat = ?, lng = ?, state_id = ?, country_id = ?, last_visited = ?, wiki_term = ? WHERE id = ?'
      )
      .run(
        name,
        lat,
        lng,
        state_id || null,
        country_id,
        last_visited,
        wiki_term,
        id
      );

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete a city
   */
  public deleteCity(id: number | string): { success: boolean; changes: number } {
    const result = db.prepare('DELETE FROM cities WHERE id = ?').run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }
}

export const cityService = CityService.getInstance();

