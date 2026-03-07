import { db } from '../db';

interface Attraction {
  id: number;
  name: string;
  is_unesco: boolean;
  is_national_park: boolean;
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
}

interface ListAttractionsOptions {
  country_id?: number;
  state_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  includeDisabled?: boolean;
}

interface CreateAttractionData {
  name: string;
  country_id: number;
  state_id?: number | null;
  is_unesco?: boolean;
  is_national_park?: boolean;
  lat: number;
  lng: number;
  last_visited?: string;
  wiki_term?: string;
}

interface UpdateAttractionData {
  name?: string;
  country_id?: number;
  state_id?: number | null;
  is_unesco?: boolean;
  is_national_park?: boolean;
  lat?: number;
  lng?: number;
  last_visited?: string;
  wiki_term?: string;
}

class AttractionService {
  private static instance: AttractionService;
  private validColumns = ['attractions.name', 'lat', 'lng', 'wiki_term', 'country_name', 'last_visited', 'created_date', 'updated_date', 'disabled_date'];

  private constructor() {}

  public static getInstance(): AttractionService {
    if (!AttractionService.instance) {
      AttractionService.instance = new AttractionService();
    }
    return AttractionService.instance;
  }

  public async getAttractions(options: ListAttractionsOptions): Promise<{
    attractions: Attraction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { country_id, state_id, search, page = 1, limit = 25, sortBy = 'attractions.name', sortOrder = 'asc', includeDisabled = false } = options;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();
    if (sortByStr === 'name') sortByStr = 'attractions.name';
    if (!this.validColumns.includes(sortByStr)) throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const offset = (page - 1) * limit;
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
      whereClauses.push(`(attractions.name ILIKE $${paramIdx} OR countries.name ILIKE $${paramIdx})`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT attractions.id, attractions.name, attractions.lat, attractions.lng,
             attractions.wiki_term, attractions.is_unesco, attractions.is_national_park,
             attractions.state_id,
             attractions.created_date, attractions.updated_date, attractions.disabled_date,
             countries.name AS country_name,
             states.name AS state_name
      FROM attractions
      JOIN countries ON attractions.country_id = countries.id
      LEFT JOIN states ON attractions.state_id = states.id
      ${whereClause}
      ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const attractions = await db.all<Attraction>(query, params);

    const countParams: any[] = [];
    let countParamIdx = 1;
    const countWhereClauses: string[] = includeDisabled ? [] : ['attractions.disabled_date IS NULL'];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countWhereClauses.push(`attractions.country_id = $${countParamIdx++}`);
      countParams.push(country_id);
    }
    if (state_id !== undefined && !Number.isNaN(state_id)) {
      countWhereClauses.push(`attractions.state_id = $${countParamIdx++}`);
      countParams.push(state_id);
    }
    if (search && search.trim()) {
      countWhereClauses.push(`(attractions.name ILIKE $${countParamIdx} OR countries.name ILIKE $${countParamIdx})`);
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
    return db.get<Attraction>(
      `SELECT attractions.id, attractions.name, attractions.is_unesco, attractions.is_national_park,
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
  }

  public async createAttraction(data: CreateAttractionData): Promise<{ id: number }> {
    const { name, country_id, state_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term } = data;
    const result = await db.run(
      `INSERT INTO attractions (name, country_id, state_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [name, country_id, state_id || null, !!is_unesco, !!is_national_park, lat, lng, last_visited || null, wiki_term]
    );
    return { id: result.rows[0].id };
  }

  public async updateAttraction(id: number | string, data: UpdateAttractionData): Promise<{ success: boolean; changes: number }> {
    const { name, country_id, state_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term } = data;
    const result = await db.run(
      `UPDATE attractions SET name=$1, country_id=$2, state_id=$3, is_unesco=$4, is_national_park=$5,
       lat=$6, lng=$7, last_visited=$8, wiki_term=$9, updated_date=NOW() WHERE id=$10`,
      [name, country_id, state_id ?? null, !!is_unesco, !!is_national_park, lat, lng, last_visited || null, wiki_term, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async deleteAttraction(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('UPDATE attractions SET disabled_date = NOW() WHERE id = $1 AND disabled_date IS NULL', [id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const attractionService = AttractionService.getInstance();
