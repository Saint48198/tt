import { db } from '../db';

interface Attraction {
  id: number;
  name: string;
  is_unesco: number;
  is_national_park: number;
  lat: number;
  lng: number;
  last_visited?: string;
  wiki_term?: string;
  country_id: number;
  country_name?: string;
}

interface ListAttractionsOptions {
  country_id?: number;
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
  private validColumns = [
    'attractions.name',
    'lat',
    'lng',
    'wiki_term',
    'country_name',
  ];

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): AttractionService {
    if (!AttractionService.instance) {
      AttractionService.instance = new AttractionService();
    }
    return AttractionService.instance;
  }

  /**
   * Get all attractions or paginated attractions with sorting and filtering
   */
  public getAttractions(options: ListAttractionsOptions): {
    attractions: Attraction[];
    total: number;
    page: number;
    limit: number;
  } {
    const {
      country_id,
      page = 1,
      limit = 25,
      sortBy = 'attractions.name',
      sortOrder = 'asc',
    } = options;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();

    if (sortByStr === 'name') {
      sortByStr = 'attractions.name';
    }

    if (!this.validColumns.includes(sortByStr)) {
      throw new Error('Invalid sort column.');
    }

    if (!['asc', 'desc'].includes(sortOrderStr)) {
      throw new Error('Invalid sort order.');
    }

    const offset = (page - 1) * limit;

    let query = `
      SELECT
        attractions.id,
        attractions.name,
        attractions.lat,
        attractions.lng,
        attractions.wiki_term,
        countries.name AS country_name
      FROM attractions
      JOIN countries ON attractions.country_id = countries.id
    `;

    const params: (string | number)[] = [];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      query += ` WHERE attractions.country_id = ?`;
      params.push(country_id);
    }

    query += ` ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const attractions = db.prepare(query).all(...params) as Attraction[];

    let countQuery = `SELECT COUNT(*) as total FROM attractions`;
    const countParams: (string | number)[] = [];

    if (country_id !== undefined && !Number.isNaN(country_id)) {
      countQuery += ` WHERE country_id = ?`;
      countParams.push(country_id);
    }

    const totalRow = db.prepare(countQuery).get(...countParams) as {
      total: number;
    };

    return {
      attractions,
      total: totalRow.total,
      page,
      limit,
    };
  }

  /**
   * Get an attraction by ID
   */
  public getAttractionById(id: number | string): Attraction | undefined {
    return db
      .prepare(
        `SELECT attractions.id,
                attractions.name,
                attractions.is_unesco,
                attractions.is_national_park,
                attractions.lat,
                attractions.lng,
                attractions.last_visited,
                attractions.wiki_term,
                countries.id as country_id
         FROM attractions
         JOIN countries ON attractions.country_id = countries.id
         WHERE attractions.id = ?`
      )
      .get(id) as Attraction | undefined;
  }

  /**
   * Create a new attraction
   */
  public createAttraction(data: CreateAttractionData): { id: number } {
    const {
      name,
      country_id,
      is_unesco,
      is_national_park,
      lat,
      lng,
      last_visited,
      wiki_term,
    } = data;

    const result = db
      .prepare(
        `INSERT INTO attractions
          (name, country_id, is_unesco, is_national_park, lat, lng, last_visited, wiki_term)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        country_id,
        is_unesco ? 1 : 0,
        is_national_park ? 1 : 0,
        lat,
        lng,
        last_visited || null,
        wiki_term
      );

    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Update an attraction
   */
  public updateAttraction(
    id: number | string,
    data: UpdateAttractionData
  ): { success: boolean; changes: number } {
    const {
      name,
      country_id,
      is_unesco,
      is_national_park,
      lat,
      lng,
      last_visited,
      wiki_term,
    } = data;

    const result = db
      .prepare(
        `UPDATE attractions
         SET name = ?,
             country_id = ?,
             is_unesco = ?,
             is_national_park = ?,
             lat = ?,
             lng = ?,
             last_visited = ?,
             wiki_term = ?
         WHERE id = ?`
      )
      .run(
        name,
        country_id,
        is_unesco ? 1 : 0,
        is_national_park ? 1 : 0,
        lat,
        lng,
        last_visited || null,
        wiki_term,
        id
      );

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete an attraction
   */
  public deleteAttraction(id: number | string): { success: boolean; changes: number } {
    const result = db.prepare(`DELETE FROM attractions WHERE id = ?`).run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }
}

export const attractionService = AttractionService.getInstance();

