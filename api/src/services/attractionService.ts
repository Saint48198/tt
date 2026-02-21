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
}

interface ListAttractionsOptions {
  country_id?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface CreateAttractionData {
  name: string;
  country_id: number;
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
  is_unesco?: boolean;
  is_national_park?: boolean;
  lat?: number;
  lng?: number;
  last_visited?: string;
  wiki_term?: string;
}

class AttractionService {
  private static instance: AttractionService;
  private validColumns = ['attractions.name', 'lat', 'lng', 'wiki_term', 'country_name', 'last_visited'];

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
    const { country_id, search, page = 1, limit = 25, sortBy = 'attractions.name', sortOrder = 'asc' } = options;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();
    if (sortByStr === 'name') sortByStr = 'attractions.name';
    if (!this.validColumns.includes(sortByStr)) throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const offset = (page - 1) * limit;
    const params: any[] = [];
    let paramIdx = 1;
    const whereClauses: string[] = [];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      whereClauses.push(`attractions.country_id = $${paramIdx++}`);
      params.push(country_id);
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
             countries.name AS country_name
      FROM attractions
      JOIN countries ON attractions.country_id = countries.id
      ${whereClause}
      ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const attractions = await db.all<Attraction>(query, params);

    const countParams: any[] = [];
    let countParamIdx = 1;
    const countWhereClauses: string[] = [];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countWhereClauses.push(`attractions.country_id = $${countParamIdx++}`);
      countParams.push(country_id);
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
              countries.id as country_id
       FROM attractions
       JOIN countries ON attractions.country_id = countries.id
       WHERE attractions.id = $1`,
      [id]
    );
  }

  public async createAttraction(data: CreateAttractionData): Promise<{ id: number }> {
    const { name, country_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term } = data;
    const result = await db.run(
      `INSERT INTO attractions (name, country_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name, country_id, !!is_unesco, !!is_national_park, lat, lng, last_visited || null, wiki_term]
    );
    return { id: result.rows[0].id };
  }

  public async updateAttraction(id: number | string, data: UpdateAttractionData): Promise<{ success: boolean; changes: number }> {
    const { name, country_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term } = data;
    const result = await db.run(
      `UPDATE attractions SET name=$1, country_id=$2, is_unesco=$3, is_national_park=$4,
       lat=$5, lng=$6, last_visited=$7, wiki_term=$8 WHERE id=$9`,
      [name, country_id, !!is_unesco, !!is_national_park, lat, lng, last_visited || null, wiki_term, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async deleteAttraction(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM attractions WHERE id = $1', [id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const attractionService = AttractionService.getInstance();
