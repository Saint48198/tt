import { db } from '../db';

interface CountryAlias {
  id: number;
  country_id: number;
  alias: string;
  created_date?: string;
}

interface Country {
  id: number;
  name: string;
  abbreviation?: string;
  lat?: number;
  lng?: number;
  slug?: string;
  region?: string;
  sub_region?: string;
  world_region_id?: number | null;
  world_sub_region_id?: number | null;
  world_region_name?: string;
  world_sub_region_name?: string;
  last_visited?: string;
  geo_map_id?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  aliases?: CountryAlias[];
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
    'region',
    'sub_region',
    'world_region_id',
    'world_sub_region_id',
    'last_visited',
    'geo_map_id',
    'created_date',
    'updated_date',
    'disabled_date',
  ];

  private readonly selectWithRegions = `
    SELECT c.*,
           wr.name AS world_region_name,
           wsr.name AS world_sub_region_name
    FROM countries c
    LEFT JOIN world_regions wr ON c.world_region_id = wr.id
    LEFT JOIN world_sub_regions wsr ON c.world_sub_region_id = wsr.id
  `;

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

    const disabledFilter = includeDisabled ? '' : 'WHERE c.disabled_date IS NULL';

    if (all) {
      const countries = await db.all<Country>(
        `${this.selectWithRegions} ${disabledFilter} ORDER BY c.${sortByStr} ${sortOrderStr.toUpperCase()}`
      );
      await this.attachAliases(countries);
      return { total: countries.length, countries };
    }

    const offset = (page - 1) * limit;
    const totalRow = await db.get<{ count: string }>(
      `SELECT COUNT(*) AS count FROM countries c ${disabledFilter}`
    );
    const countries = await db.all<Country>(
      `${this.selectWithRegions} ${disabledFilter} ORDER BY c.${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    await this.attachAliases(countries);

    return { total: Number(totalRow?.count ?? 0), countries, page, limit };
  }

  public async getCountryById(id: number | string): Promise<Country | undefined> {
    const country = await db.get<Country>(
      `${this.selectWithRegions} WHERE c.id = $1 AND c.disabled_date IS NULL`,
      [id]
    );
    if (country) {
      country.aliases = await db.all<CountryAlias>(
        'SELECT * FROM country_aliases WHERE country_id = $1 ORDER BY alias',
        [id]
      );
    }
    return country;
  }

  public async createCountry(data: {
    name: string;
    abbreviation?: string;
    lat?: number;
    lng?: number;
    slug?: string;
    region?: string;
    sub_region?: string;
    world_region_id?: number | null;
    world_sub_region_id?: number | null;
    last_visited?: string;
    geo_map_id?: string;
  }): Promise<{ id: number }> {
    const {
      name,
      abbreviation,
      lat,
      lng,
      slug,
      region,
      sub_region,
      world_region_id,
      world_sub_region_id,
      last_visited,
      geo_map_id,
    } = data;
    const result = await db.run(
      `INSERT INTO countries (name, abbreviation, lat, lng, slug, region, sub_region, world_region_id, world_sub_region_id, last_visited, geo_map_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        name,
        abbreviation,
        lat,
        lng,
        slug,
        region,
        sub_region,
        world_region_id || null,
        world_sub_region_id || null,
        last_visited,
        geo_map_id,
      ]
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
      region?: string;
      sub_region?: string;
      world_region_id?: number | null;
      world_sub_region_id?: number | null;
      last_visited?: string;
      geo_map_id?: string;
    }
  ): Promise<{ success: boolean; changes: number }> {
    const {
      name,
      abbreviation,
      lat,
      lng,
      slug,
      region,
      sub_region,
      world_region_id,
      world_sub_region_id,
      last_visited,
      geo_map_id,
    } = data;
    const result = await db.run(
      `UPDATE countries SET name = $1, abbreviation = $2, lat = $3, lng = $4, slug = $5,
       region = $6, sub_region = $7, world_region_id = $8, world_sub_region_id = $9,
       last_visited = $10, geo_map_id = $11, updated_date = NOW() WHERE id = $12`,
      [
        name,
        abbreviation,
        lat,
        lng,
        slug,
        region,
        sub_region,
        world_region_id || null,
        world_sub_region_id || null,
        last_visited,
        geo_map_id,
        id,
      ]
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

  /**
   * Attach aliases to an array of countries in a single query.
   */
  private async attachAliases(countries: Country[]): Promise<void> {
    if (countries.length === 0) return;
    const ids = countries.map((c) => c.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const aliases = await db.all<CountryAlias>(
      `SELECT * FROM country_aliases WHERE country_id IN (${placeholders}) ORDER BY alias`,
      ids
    );
    const aliasMap = new Map<number, CountryAlias[]>();
    for (const a of aliases) {
      if (!aliasMap.has(a.country_id)) aliasMap.set(a.country_id, []);
      aliasMap.get(a.country_id)!.push(a);
    }
    for (const c of countries) {
      c.aliases = aliasMap.get(c.id) || [];
    }
  }

  // --- Country Alias CRUD ---

  public async getAliases(countryId: number | string): Promise<CountryAlias[]> {
    return db.all<CountryAlias>(
      'SELECT * FROM country_aliases WHERE country_id = $1 ORDER BY alias',
      [countryId]
    );
  }

  public async addAlias(countryId: number | string, alias: string): Promise<{ id: number }> {
    const result = await db.run(
      'INSERT INTO country_aliases (country_id, alias) VALUES ($1, $2) RETURNING id',
      [countryId, alias.trim()]
    );
    return { id: result.rows[0].id };
  }

  public async removeAlias(aliasId: number | string): Promise<{ success: boolean }> {
    const result = await db.run('DELETE FROM country_aliases WHERE id = $1', [aliasId]);
    return { success: result.rowCount > 0 };
  }

  /**
   * Find a country by checking its name, abbreviation, or aliases.
   * Used for reverse-geocode country matching.
   */
  public async findCountryByAlias(name: string): Promise<Country | undefined> {
    const lower = name.toLowerCase().trim();

    // Check name or abbreviation first
    let country = await db.get<Country>(
      `SELECT * FROM countries
       WHERE disabled_date IS NULL
         AND (LOWER(name) = $1 OR LOWER(abbreviation) = $1)`,
      [lower]
    );
    if (country) return country;

    // Check aliases table
    const aliasRow = await db.get<{ country_id: number }>(
      `SELECT country_id FROM country_aliases WHERE LOWER(alias) = $1`,
      [lower]
    );
    if (aliasRow) {
      country = await db.get<Country>(
        'SELECT * FROM countries WHERE id = $1 AND disabled_date IS NULL',
        [aliasRow.country_id]
      );
    }
    return country;
  }
}

export const countryService = CountryService.getInstance();
