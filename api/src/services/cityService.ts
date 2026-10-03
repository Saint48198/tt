import { db } from '../db';

/**
 * Thrown when an attempt is made to create/rename a city into an
 * already-existing (name + country + state) triple.
 */
export class DuplicateCityError extends Error {
  readonly code = 'DUPLICATE_CITY';
  constructor(name: string, stateName: string | undefined, countryName: string) {
    const where = stateName
      ? `${stateName}, ${countryName}`
      : countryName || 'the selected country';
    super(`A city named "${name}" already exists in ${where}.`);
    this.name = 'DuplicateCityError';
  }
}

/** True if a caught DB error is a unique-index violation on the given index. */
function isUniqueViolation(err: unknown, indexName?: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; constraint?: string };
  if (e.code !== '23505') return false;
  if (!indexName) return true;
  return e.constraint === indexName;
}

interface CityAlias {
  id: number;
  city_id: number;
  alias: string;
  created_date?: string;
}

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
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  aliases?: CityAlias[];
}

interface ListCitiesOptions {
  country_id?: number;
  state_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sort?: string;
  includeDisabled?: boolean;
}

class CityService {
  private static instance: CityService;
  private validColumns = [
    'cities.name',
    'lat',
    'lng',
    'country_name',
    'state_name',
    'last_visited',
    'created_date',
    'updated_date',
    'disabled_date',
  ];

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
    const {
      country_id,
      state_id,
      search,
      page = 1,
      limit = 25,
      all = false,
      sortBy = 'cities.name',
      sort = 'asc',
      includeDisabled = false,
    } = options;
    const offset = (page - 1) * limit;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sort.toString().toLowerCase();
    if (sortByStr === 'name') sortByStr = 'cities.name';
    if (sortByStr && !this.validColumns.includes(sortByStr))
      throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const params: any[] = [];
    let paramIdx = 1;
    const whereClauses: string[] = includeDisabled ? [] : ['cities.disabled_date IS NULL'];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      whereClauses.push(`cities.country_id = $${paramIdx++}`);
      params.push(country_id);
    }

    if (state_id !== undefined && !Number.isNaN(state_id)) {
      whereClauses.push(`cities.state_id = $${paramIdx++}`);
      params.push(state_id);
    }

    if (search && search.trim()) {
      whereClauses.push(
        `(cities.name ILIKE $${paramIdx} OR countries.name ILIKE $${paramIdx} OR states.name ILIKE $${paramIdx})`
      );
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let query = `
      SELECT cities.id, cities.name, cities.lat, cities.lng, cities.last_visited,
             cities.created_date, cities.updated_date, cities.disabled_date,
             cities.country_id, countries.name AS country_name, cities.state_id, states.name AS state_name
      FROM cities
      JOIN countries ON cities.country_id = countries.id
      LEFT JOIN states ON cities.state_id = states.id
      ${whereClause}
      ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`;

    if (!all) {
      query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      params.push(limit, offset);
    }

    const cities = await db.all<City>(query, params);

    const countParams: any[] = [];
    let countParamIdx = 1;
    const countWhereClauses: string[] = includeDisabled ? [] : ['cities.disabled_date IS NULL'];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countWhereClauses.push(`cities.country_id = $${countParamIdx++}`);
      countParams.push(country_id);
    }
    if (state_id !== undefined && !Number.isNaN(state_id)) {
      countWhereClauses.push(`cities.state_id = $${countParamIdx++}`);
      countParams.push(state_id);
    }
    if (search && search.trim()) {
      countWhereClauses.push(
        `(cities.name ILIKE $${countParamIdx} OR countries.name ILIKE $${countParamIdx} OR states.name ILIKE $${countParamIdx})`
      );
      countParams.push(`%${search.trim()}%`);
      countParamIdx++;
    }

    let countQuery = `SELECT COUNT(*) as total FROM cities
      JOIN countries ON cities.country_id = countries.id
      LEFT JOIN states ON cities.state_id = states.id`;
    if (countWhereClauses.length > 0) {
      countQuery += ` WHERE ${countWhereClauses.join(' AND ')}`;
    }
    const totalRow = await db.get<{ total: string }>(countQuery, countParams);

    return { cities, total: Number(totalRow?.total ?? 0), page, limit };
  }

  public async getCityById(id: number | string): Promise<City | undefined> {
    const city = await db.get<City>(
      `SELECT cities.id, cities.name, cities.lat, cities.lng, cities.last_visited,
              cities.created_date, cities.updated_date, cities.disabled_date,
              cities.country_id, countries.name AS country_name,
              cities.state_id, states.name AS state_name, cities.wiki_term
       FROM cities
       LEFT JOIN countries ON cities.country_id = countries.id
       LEFT JOIN states ON cities.state_id = states.id
       WHERE cities.id = $1 AND cities.disabled_date IS NULL`,
      [id]
    );
    if (city) {
      city.aliases = await db.all<CityAlias>(
        'SELECT * FROM city_aliases WHERE city_id = $1 ORDER BY alias',
        [id]
      );
    }
    return city;
  }

  public async createCity(data: {
    name: string;
    lat: number;
    lng: number;
    state_id?: number;
    country_id: number;
    last_visited?: string;
    wiki_term?: string;
  }): Promise<{ id: number }> {
    const { name, lat, lng, state_id, country_id, last_visited, wiki_term } = data;

    // Prevent duplicates: same name + country + state (where state may be NULL).
    const dup = await this.findDuplicateCity(name, country_id, state_id);
    if (dup) {
      throw new DuplicateCityError(name, dup.state_name ?? undefined, dup.country_name ?? '');
    }

    try {
      const result = await db.run(
        'INSERT INTO cities (name, lat, lng, state_id, country_id, last_visited, wiki_term) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [name, lat, lng, state_id || null, country_id, last_visited, wiki_term]
      );
      return { id: result.rows[0].id };
    } catch (err) {
      // Race condition: another request inserted the same city between our
      // check and this INSERT. The DB unique index will reject it.
      if (isUniqueViolation(err, 'idx_cities_unique_name_country_state')) {
        throw new DuplicateCityError(name, undefined, '');
      }
      throw err;
    }
  }

  public async updateCity(
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
  ): Promise<{ success: boolean; changes: number }> {
    const { name, lat, lng, state_id, country_id, last_visited, wiki_term } = data;

    // Prevent renaming into an existing (name, country, state) triple.
    const dup = await this.findDuplicateCity(name, country_id, state_id, Number(id));
    if (dup) {
      throw new DuplicateCityError(name, dup.state_name ?? undefined, dup.country_name ?? '');
    }

    try {
      const result = await db.run(
        'UPDATE cities SET name=$1, lat=$2, lng=$3, state_id=$4, country_id=$5, last_visited=$6, wiki_term=$7, updated_date=NOW() WHERE id=$8',
        [name, lat, lng, state_id || null, country_id, last_visited, wiki_term, id]
      );
      return { success: result.rowCount > 0, changes: result.rowCount };
    } catch (err) {
      if (isUniqueViolation(err, 'idx_cities_unique_name_country_state')) {
        throw new DuplicateCityError(name, undefined, '');
      }
      throw err;
    }
  }

  /**
   * Look up an existing city with the same case-insensitive name, country_id
   * and state_id (state_id NULL matches state_id NULL). Optionally excludes
   * a specific city id (used when updating).
   */
  private async findDuplicateCity(
    name: string,
    countryId: number,
    stateId: number | undefined,
    excludeId?: number
  ): Promise<{ id: number; country_name: string | null; state_name: string | null } | undefined> {
    const params: any[] = [name.trim(), countryId];
    let sql = `
      SELECT ci.id,
             co.name AS country_name,
             s.name  AS state_name
        FROM cities ci
        JOIN countries co ON co.id = ci.country_id
        LEFT JOIN states s ON s.id = ci.state_id
       WHERE ci.disabled_date IS NULL
         AND LOWER(ci.name) = LOWER($1)
         AND ci.country_id = $2`;
    if (stateId != null) {
      params.push(stateId);
      sql += ` AND ci.state_id = $${params.length}`;
    } else {
      sql += ` AND ci.state_id IS NULL`;
    }
    if (excludeId != null) {
      params.push(excludeId);
      sql += ` AND ci.id <> $${params.length}`;
    }
    sql += ` LIMIT 1`;
    return db.get<{ id: number; country_name: string | null; state_name: string | null }>(
      sql,
      params
    );
  }

  public async deleteCity(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run(
      'UPDATE cities SET disabled_date = NOW() WHERE id = $1 AND disabled_date IS NULL',
      [id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Attach aliases to an array of cities in a single query.
   */
  private async attachAliases(cities: City[]): Promise<void> {
    if (cities.length === 0) return;
    const ids = cities.map((c) => c.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const aliases = await db.all<CityAlias>(
      `SELECT * FROM city_aliases WHERE city_id IN (${placeholders}) ORDER BY alias`,
      ids
    );
    const aliasMap = new Map<number, CityAlias[]>();
    for (const a of aliases) {
      if (!aliasMap.has(a.city_id)) aliasMap.set(a.city_id, []);
      aliasMap.get(a.city_id)!.push(a);
    }
    for (const c of cities) {
      c.aliases = aliasMap.get(c.id) || [];
    }
  }

  // --- City Alias CRUD ---

  public async getAliases(cityId: number | string): Promise<CityAlias[]> {
    return db.all<CityAlias>('SELECT * FROM city_aliases WHERE city_id = $1 ORDER BY alias', [
      cityId,
    ]);
  }

  public async addAlias(cityId: number | string, alias: string): Promise<{ id: number }> {
    const result = await db.run(
      'INSERT INTO city_aliases (city_id, alias) VALUES ($1, $2) RETURNING id',
      [cityId, alias.trim()]
    );
    return { id: result.rows[0].id };
  }

  public async removeAlias(aliasId: number | string): Promise<{ success: boolean }> {
    const result = await db.run('DELETE FROM city_aliases WHERE id = $1', [aliasId]);
    return { success: result.rowCount > 0 };
  }

  /**
   * Find a city by checking its name or aliases.
   * Used for reverse-geocode city matching.
   */
  public async findCityByAlias(name: string): Promise<City | undefined> {
    const lower = name.toLowerCase().trim();

    // Check name first
    let city = await db.get<City>(
      `SELECT cities.*, countries.name AS country_name, states.name AS state_name
       FROM cities
       LEFT JOIN countries ON cities.country_id = countries.id
       LEFT JOIN states ON cities.state_id = states.id
       WHERE cities.disabled_date IS NULL
         AND LOWER(cities.name) = $1`,
      [lower]
    );
    if (city) return city;

    // Check aliases table
    const aliasRow = await db.get<{ city_id: number }>(
      `SELECT city_id FROM city_aliases WHERE LOWER(alias) = $1`,
      [lower]
    );
    if (aliasRow) {
      city = await db.get<City>(
        `SELECT cities.*, countries.name AS country_name, states.name AS state_name
         FROM cities
         LEFT JOIN countries ON cities.country_id = countries.id
         LEFT JOIN states ON cities.state_id = states.id
         WHERE cities.id = $1 AND cities.disabled_date IS NULL`,
        [aliasRow.city_id]
      );
    }
    return city;
  }
}

export const cityService = CityService.getInstance();
