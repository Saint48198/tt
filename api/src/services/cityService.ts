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
  private validColumns = ['cities.name', 'lat', 'lng', 'country_name', 'state_name'];

  private constructor() {}

  public static getInstance(): CityService {
    if (!CityService.instance) {
      CityService.instance = new CityService();
    }
    return CityService.instance;
  }

  public async getCities(options: ListCitiesOptions): Promise<{
    cities: City[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { country_id, page = 1, limit = 25, sortBy = 'cities.name', sort = 'asc' } = options;
    const offset = (page - 1) * limit;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sort.toString().toLowerCase();
    if (sortByStr === 'name') sortByStr = 'cities.name';
    if (sortByStr && !this.validColumns.includes(sortByStr)) throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const params: any[] = [];
    let paramIdx = 1;

    let whereClause = '';
    if (country_id !== undefined && !Number.isNaN(country_id)) {
      whereClause = `WHERE cities.country_id = $${paramIdx++}`;
      params.push(country_id);
    }

    const query = `
      SELECT cities.id, cities.name, cities.lat, cities.lng, cities.last_visited,
             countries.name AS country_name, states.name AS state_name
      FROM cities
      JOIN countries ON cities.country_id = countries.id
      LEFT JOIN states ON cities.state_id = states.id
      ${whereClause}
      ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const cities = await db.all<City>(query, params);

    const countParams: any[] = [];
    let countQuery = 'SELECT COUNT(*) as total FROM cities';
    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countQuery += ' WHERE country_id = $1';
      countParams.push(country_id);
    }
    const totalRow = await db.get<{ total: string }>(countQuery, countParams);

    return { cities, total: Number(totalRow?.total ?? 0), page, limit };
  }

  public async getCityById(id: number | string): Promise<City | undefined> {
    return db.get<City>(
      `SELECT cities.id, cities.name, cities.lat, cities.lng, cities.last_visited,
              cities.country_id, countries.name AS country_name,
              cities.state_id, states.name AS state_name, cities.wiki_term
       FROM cities
       LEFT JOIN countries ON cities.country_id = countries.id
       LEFT JOIN states ON cities.state_id = states.id
       WHERE cities.id = $1`,
      [id]
    );
  }

  public async createCity(data: {
    name: string; lat: number; lng: number; state_id?: number;
    country_id: number; last_visited?: string; wiki_term?: string;
  }): Promise<{ id: number }> {
    const { name, lat, lng, state_id, country_id, last_visited, wiki_term } = data;
    const result = await db.run(
      'INSERT INTO cities (name, lat, lng, state_id, country_id, last_visited, wiki_term) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [name, lat, lng, state_id || null, country_id, last_visited, wiki_term]
    );
    return { id: result.rows[0].id };
  }

  public async updateCity(id: number | string, data: {
    name: string; lat: number; lng: number; state_id?: number;
    country_id: number; last_visited?: string; wiki_term?: string;
  }): Promise<{ success: boolean; changes: number }> {
    const { name, lat, lng, state_id, country_id, last_visited, wiki_term } = data;
    const result = await db.run(
      'UPDATE cities SET name=$1, lat=$2, lng=$3, state_id=$4, country_id=$5, last_visited=$6, wiki_term=$7 WHERE id=$8',
      [name, lat, lng, state_id || null, country_id, last_visited, wiki_term, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async deleteCity(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM cities WHERE id = $1', [id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const cityService = CityService.getInstance();

