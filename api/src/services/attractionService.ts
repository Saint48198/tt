import { db } from '../db';

interface AttractionType {
  id: number;
  name: string;
  slug: string;
}

interface AttractionAlias {
  id: number;
  attraction_id: number;
  alias: string;
  created_date?: string;
}

interface Attraction {
  id: number;
  name: string;
  types: AttractionType[];
  lat: number;
  lng: number;
  last_visited?: string;
  wiki_term?: string;
  country_id: number;
  country_name?: string;
  state_id?: number;
  state_name?: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
  aliases?: AttractionAlias[];
}

interface ListAttractionsOptions {
  country_id?: number;
  state_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: string;
  includeDisabled?: boolean;
}

interface CreateAttractionData {
  name: string;
  country_id: number;
  state_id?: number | null;
  type_ids?: number[];
  lat: number;
  lng: number;
  last_visited?: string;
  wiki_term?: string;
}

interface UpdateAttractionData {
  name?: string;
  country_id?: number;
  state_id?: number | null;
  type_ids?: number[];
  lat?: number;
  lng?: number;
  last_visited?: string;
  wiki_term?: string;
}

class AttractionService {
  private static instance: AttractionService;
  private validColumns = [
    'attractions.name',
    'lat',
    'lng',
    'wiki_term',
    'country_name',
    'last_visited',
    'created_date',
    'updated_date',
    'disabled_date',
  ];

  private constructor() {}

  public static getInstance(): AttractionService {
    if (!AttractionService.instance) {
      AttractionService.instance = new AttractionService();
    }
    return AttractionService.instance;
  }

  /**
   * Get all attraction types
   */
  public async getAttractionTypes(): Promise<AttractionType[]> {
    return db.all<AttractionType>('SELECT id, name, slug FROM attraction_types ORDER BY name', []);
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create a new attraction type
   */
  public async createAttractionType(name: string): Promise<{ id: number }> {
    const slug = this.slugify(name);
    const existing = await db.get<AttractionType>(
      'SELECT id FROM attraction_types WHERE slug = $1',
      [slug]
    );
    if (existing) throw new Error('Type with this name already exists.');
    const result = await db.run(
      'INSERT INTO attraction_types (name, slug) VALUES ($1, $2) RETURNING id',
      [name, slug]
    );
    return { id: result.rows[0].id };
  }

  /**
   * Update an attraction type
   */
  public async updateAttractionType(id: number, name: string): Promise<{ success: boolean }> {
    const slug = this.slugify(name);
    const existing = await db.get<AttractionType>(
      'SELECT id FROM attraction_types WHERE slug = $1 AND id != $2',
      [slug, id]
    );
    if (existing) throw new Error('Type with this name already exists.');
    const result = await db.run('UPDATE attraction_types SET name = $1, slug = $2 WHERE id = $3', [
      name,
      slug,
      id,
    ]);
    return { success: result.rowCount > 0 };
  }

  /**
   * Delete an attraction type (and its assignments)
   */
  public async deleteAttractionType(id: number): Promise<{ success: boolean }> {
    await db.run('DELETE FROM attraction_type_assignments WHERE type_id = $1', [id]);
    const result = await db.run('DELETE FROM attraction_types WHERE id = $1', [id]);
    return { success: result.rowCount > 0 };
  }

  /**
   * Attach types array to each attraction by querying the junction table.
   */
  private async attachTypes(attractions: Attraction[]): Promise<void> {
    if (attractions.length === 0) return;
    const ids = attractions.map((a) => a.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const rows = await db.all<{ attraction_id: number; id: number; name: string; slug: string }>(
      `SELECT ata.attraction_id, at.id, at.name, at.slug
       FROM attraction_type_assignments ata
       JOIN attraction_types at ON ata.type_id = at.id
       WHERE ata.attraction_id IN (${placeholders})`,
      ids
    );
    const typeMap = new Map<number, AttractionType[]>();
    for (const row of rows) {
      if (!typeMap.has(row.attraction_id)) typeMap.set(row.attraction_id, []);
      typeMap.get(row.attraction_id)!.push({ id: row.id, name: row.name, slug: row.slug });
    }
    for (const a of attractions) {
      a.types = typeMap.get(a.id) || [];
    }
  }

  /**
   * Replace all type assignments for an attraction.
   */
  private async setTypes(attractionId: number, typeIds: number[]): Promise<void> {
    await db.run('DELETE FROM attraction_type_assignments WHERE attraction_id = $1', [
      attractionId,
    ]);
    for (const typeId of typeIds) {
      await db.run(
        'INSERT INTO attraction_type_assignments (attraction_id, type_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [attractionId, typeId]
      );
    }
  }

  public async getAttractions(options: ListAttractionsOptions): Promise<{
    attractions: Attraction[];
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
      sortBy = 'attractions.name',
      sortOrder = 'asc',
      includeDisabled = false,
    } = options;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();
    if (sortByStr === 'name') sortByStr = 'attractions.name';
    if (!this.validColumns.includes(sortByStr)) throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const params: any[] = [];
    let paramIdx = 1;
    const whereClauses: string[] = includeDisabled ? [] : ['attractions.disabled_date IS NULL'];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      whereClauses.push(`attractions.country_id = $${paramIdx++}`);
      params.push(country_id);
    }

    if (state_id !== undefined && !Number.isNaN(state_id)) {
      whereClauses.push(`attractions.state_id = $${paramIdx++}`);
      params.push(state_id);
    }

    if (search && search.trim()) {
      whereClauses.push(
        `(attractions.name ILIKE $${paramIdx} OR countries.name ILIKE $${paramIdx})`
      );
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const baseSelect = `
      SELECT attractions.id, attractions.name, attractions.lat, attractions.lng,
             attractions.last_visited, attractions.wiki_term, attractions.state_id,
             attractions.created_date, attractions.updated_date, attractions.disabled_date,
             countries.name AS country_name,
             states.name AS state_name
      FROM attractions
      JOIN countries ON attractions.country_id = countries.id
      LEFT JOIN states ON attractions.state_id = states.id
      ${whereClause}
      ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`;

    if (all) {
      const attractions = await db.all<Attraction>(baseSelect, params);
      await this.attachTypes(attractions);
      return { attractions, total: attractions.length, page: 1, limit: attractions.length };
    }

    const offset = (page - 1) * limit;
    const query = `${baseSelect} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const attractions = await db.all<Attraction>(query, params);
    await this.attachTypes(attractions);

    const countParams: any[] = [];
    let countParamIdx = 1;
    const countWhereClauses: string[] = includeDisabled
      ? []
      : ['attractions.disabled_date IS NULL'];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countWhereClauses.push(`attractions.country_id = $${countParamIdx++}`);
      countParams.push(country_id);
    }
    if (state_id !== undefined && !Number.isNaN(state_id)) {
      countWhereClauses.push(`attractions.state_id = $${countParamIdx++}`);
      countParams.push(state_id);
    }
    if (search && search.trim()) {
      countWhereClauses.push(
        `(attractions.name ILIKE $${countParamIdx} OR countries.name ILIKE $${countParamIdx})`
      );
      countParams.push(`%${search.trim()}%`);
      countParamIdx++;
    }

    let countQuery = `SELECT COUNT(*) as total FROM attractions
      JOIN countries ON attractions.country_id = countries.id`;
    if (countWhereClauses.length > 0) {
      countQuery += ` WHERE ${countWhereClauses.join(' AND ')}`;
    }
    const totalRow = await db.get<{ total: string }>(countQuery, countParams);

    return { attractions, total: Number(totalRow?.total ?? 0), page, limit };
  }

  public async getAttractionById(id: number | string): Promise<Attraction | undefined> {
    const attraction = await db.get<Attraction>(
      `SELECT attractions.id, attractions.name,
              attractions.lat, attractions.lng, attractions.last_visited, attractions.wiki_term,
              attractions.state_id,
              attractions.created_date, attractions.updated_date, attractions.disabled_date,
              countries.id as country_id, countries.name as country_name,
              states.name as state_name
       FROM attractions
       JOIN countries ON attractions.country_id = countries.id
       LEFT JOIN states ON attractions.state_id = states.id
       WHERE attractions.id = $1 AND attractions.disabled_date IS NULL`,
      [id]
    );
    if (attraction) {
      await this.attachTypes([attraction]);
      await this.attachAliases([attraction]);
    }
    return attraction;
  }

  public async createAttraction(data: CreateAttractionData): Promise<{ id: number }> {
    const { name, country_id, state_id, type_ids, lat, lng, last_visited, wiki_term } = data;
    const result = await db.run(
      `INSERT INTO attractions (name, country_id, state_id, lat, lng, last_visited, wiki_term)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, country_id, state_id || null, lat, lng, last_visited || null, wiki_term]
    );
    const attractionId = result.rows[0].id;
    if (type_ids && type_ids.length > 0) {
      await this.setTypes(attractionId, type_ids);
    }
    return { id: attractionId };
  }

  public async updateAttraction(
    id: number | string,
    data: UpdateAttractionData
  ): Promise<{ success: boolean; changes: number }> {
    const { name, country_id, state_id, type_ids, lat, lng, last_visited, wiki_term } = data;
    const result = await db.run(
      `UPDATE attractions SET name=$1, country_id=$2, state_id=$3,
       lat=$4, lng=$5, last_visited=$6, wiki_term=$7, updated_date=NOW() WHERE id=$8`,
      [name, country_id, state_id ?? null, lat, lng, last_visited || null, wiki_term, id]
    );
    if (type_ids !== undefined) {
      await this.setTypes(Number(id), type_ids);
    }
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async deleteAttraction(
    id: number | string
  ): Promise<{ success: boolean; changes: number }> {
    const result = await db.run(
      'UPDATE attractions SET disabled_date = NOW() WHERE id = $1 AND disabled_date IS NULL',
      [id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Attach aliases array to each attraction in a single query.
   */
  private async attachAliases(attractions: Attraction[]): Promise<void> {
    if (attractions.length === 0) return;
    const ids = attractions.map((a) => a.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const aliases = await db.all<AttractionAlias>(
      `SELECT * FROM attraction_aliases WHERE attraction_id IN (${placeholders}) ORDER BY alias`,
      ids
    );
    const aliasMap = new Map<number, AttractionAlias[]>();
    for (const a of aliases) {
      if (!aliasMap.has(a.attraction_id)) aliasMap.set(a.attraction_id, []);
      aliasMap.get(a.attraction_id)!.push(a);
    }
    for (const attraction of attractions) {
      attraction.aliases = aliasMap.get(attraction.id) || [];
    }
  }

  // --- Attraction Alias CRUD ---

  public async getAliases(attractionId: number | string): Promise<AttractionAlias[]> {
    return db.all<AttractionAlias>(
      'SELECT * FROM attraction_aliases WHERE attraction_id = $1 ORDER BY alias',
      [attractionId]
    );
  }

  public async addAlias(attractionId: number | string, alias: string): Promise<{ id: number }> {
    const result = await db.run(
      'INSERT INTO attraction_aliases (attraction_id, alias) VALUES ($1, $2) RETURNING id',
      [attractionId, alias.trim()]
    );
    return { id: result.rows[0].id };
  }

  public async removeAlias(aliasId: number | string): Promise<{ success: boolean }> {
    const result = await db.run('DELETE FROM attraction_aliases WHERE id = $1', [aliasId]);
    return { success: result.rowCount > 0 };
  }

  /**
   * Find an attraction by name or alias — mirrors cityService.findCityByAlias.
   */
  public async findAttractionByAlias(name: string): Promise<Attraction | undefined> {
    const lower = name.toLowerCase().trim();

    let attraction = await db.get<Attraction>(
      `SELECT attractions.*, countries.name AS country_name, states.name AS state_name
       FROM attractions
       LEFT JOIN countries ON attractions.country_id = countries.id
       LEFT JOIN states   ON attractions.state_id   = states.id
       WHERE attractions.disabled_date IS NULL
         AND LOWER(attractions.name) = $1`,
      [lower]
    );
    if (attraction) return attraction;

    const aliasRow = await db.get<{ attraction_id: number }>(
      `SELECT attraction_id FROM attraction_aliases WHERE LOWER(alias) = $1`,
      [lower]
    );
    if (aliasRow) {
      attraction = await db.get<Attraction>(
        `SELECT attractions.*, countries.name AS country_name, states.name AS state_name
         FROM attractions
         LEFT JOIN countries ON attractions.country_id = countries.id
         LEFT JOIN states   ON attractions.state_id   = states.id
         WHERE attractions.id = $1 AND attractions.disabled_date IS NULL`,
        [aliasRow.attraction_id]
      );
    }
    return attraction;
  }
}

export const attractionService = AttractionService.getInstance();
