import { db } from '../db';

export type WishListType = 'country' | 'city' | 'attraction';

interface WishListItem {
  id: number;
  user_id: number;
  type: WishListType;
  name: string;
  country_id?: number | null;
  city_id?: number | null;
  attraction_id?: number | null;
  notes?: string | null;
  priority: number;
  created_date?: string;
  updated_date?: string;
  // Joined display fields (read-only)
  country_name?: string | null;
  city_name?: string | null;
  attraction_name?: string | null;
}

interface CreateWishListItemData {
  type: WishListType;
  name: string;
  country_id?: number | null;
  city_id?: number | null;
  attraction_id?: number | null;
  notes?: string | null;
  priority?: number;
}

interface UpdateWishListItemData {
  type?: WishListType;
  name?: string;
  country_id?: number | null;
  city_id?: number | null;
  attraction_id?: number | null;
  notes?: string | null;
  priority?: number;
}

class WishListService {
  private static instance: WishListService;

  private constructor() {
    // singleton
  }

  public static getInstance(): WishListService {
    if (!WishListService.instance) {
      WishListService.instance = new WishListService();
    }
    return WishListService.instance;
  }

  public async getAll(userId: number, type?: WishListType): Promise<WishListItem[]> {
    const baseSelect = `
      SELECT w.*,
             c.name  AS country_name,
             ci.name AS city_name,
             a.name  AS attraction_name
        FROM wish_list w
        LEFT JOIN countries   c  ON c.id  = w.country_id
        LEFT JOIN cities      ci ON ci.id = w.city_id
        LEFT JOIN attractions a  ON a.id  = w.attraction_id
       WHERE w.user_id = $1`;

    if (type) {
      return db.all<WishListItem>(
        `${baseSelect} AND w.type = $2
         ORDER BY w.priority DESC, w.created_date DESC`,
        [userId, type]
      );
    }
    return db.all<WishListItem>(
      `${baseSelect}
       ORDER BY w.priority DESC, w.created_date DESC`,
      [userId]
    );
  }

  public async getById(userId: number, id: number | string): Promise<WishListItem | undefined> {
    return db.get<WishListItem>(
      `SELECT w.*,
              c.name  AS country_name,
              ci.name AS city_name,
              a.name  AS attraction_name
         FROM wish_list w
         LEFT JOIN countries   c  ON c.id  = w.country_id
         LEFT JOIN cities      ci ON ci.id = w.city_id
         LEFT JOIN attractions a  ON a.id  = w.attraction_id
        WHERE w.id = $1 AND w.user_id = $2`,
      [id, userId]
    );
  }

  /**
   * Validate the FK ids match the chosen type and look up the canonical name.
   * Throws an Error with a user-friendly message on validation failure.
   */
  private async resolveEntity(data: {
    type: WishListType;
    country_id?: number | null;
    city_id?: number | null;
    attraction_id?: number | null;
  }): Promise<{ name: string; country_id: number | null }> {
    if (data.type === 'country') {
      if (!data.country_id) throw new Error('country_id is required for a country wish');
      const row = await db.get<{ name: string }>('SELECT name FROM countries WHERE id = $1', [
        data.country_id,
      ]);
      if (!row) throw new Error('Country not found');
      return { name: row.name, country_id: data.country_id };
    }
    if (data.type === 'city') {
      if (!data.city_id) throw new Error('city_id is required for a city wish');
      const row = await db.get<{ name: string; country_id: number }>(
        'SELECT name, country_id FROM cities WHERE id = $1',
        [data.city_id]
      );
      if (!row) throw new Error('City not found');
      return { name: row.name, country_id: row.country_id };
    }
    // attraction
    if (!data.attraction_id) throw new Error('attraction_id is required for an attraction wish');
    const row = await db.get<{ name: string; country_id: number }>(
      'SELECT name, country_id FROM attractions WHERE id = $1',
      [data.attraction_id]
    );
    if (!row) throw new Error('Attraction not found');
    return { name: row.name, country_id: row.country_id };
  }

  public async create(userId: number, data: CreateWishListItemData): Promise<{ id: number }> {
    const resolved = await this.resolveEntity(data);
    const result = await db.run(
      `INSERT INTO wish_list
         (user_id, type, name, country_id, city_id, attraction_id, notes, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        data.type,
        resolved.name,
        resolved.country_id,
        data.type === 'city' ? (data.city_id ?? null) : null,
        data.type === 'attraction' ? (data.attraction_id ?? null) : null,
        data.notes ?? null,
        data.priority ?? 0,
      ]
    );
    return { id: result.rows[0].id };
  }

  public async update(
    userId: number,
    id: number | string,
    data: UpdateWishListItemData
  ): Promise<{ success: boolean; changes: number }> {
    // Determine the effective row (existing + patched values) so we can re-validate FKs.
    const existing = await this.getById(userId, id);
    if (!existing) return { success: false, changes: 0 };

    const effectiveType: WishListType = data.type ?? existing.type;
    const effective = {
      type: effectiveType,
      country_id: data.country_id !== undefined ? data.country_id : (existing.country_id ?? null),
      city_id: data.city_id !== undefined ? data.city_id : (existing.city_id ?? null),
      attraction_id:
        data.attraction_id !== undefined ? data.attraction_id : (existing.attraction_id ?? null),
    };

    // If any FK or type changed, re-resolve to get the canonical name.
    const needsResolve =
      data.type !== undefined ||
      data.country_id !== undefined ||
      data.city_id !== undefined ||
      data.attraction_id !== undefined;

    const resolved = needsResolve ? await this.resolveEntity(effective) : null;

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.type !== undefined) {
      fields.push(`type = $${i++}`);
      values.push(data.type);
    }
    if (resolved) {
      fields.push(`name = $${i++}`);
      values.push(resolved.name);
      fields.push(`country_id = $${i++}`);
      values.push(resolved.country_id);
      fields.push(`city_id = $${i++}`);
      values.push(effectiveType === 'city' ? effective.city_id : null);
      fields.push(`attraction_id = $${i++}`);
      values.push(effectiveType === 'attraction' ? effective.attraction_id : null);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${i++}`);
      values.push(data.notes);
    }
    if (data.priority !== undefined) {
      fields.push(`priority = $${i++}`);
      values.push(data.priority);
    }

    if (fields.length === 0) {
      return { success: false, changes: 0 };
    }

    fields.push(`updated_date = NOW()`);
    values.push(id);
    values.push(userId);

    const result = await db.run(
      `UPDATE wish_list SET ${fields.join(', ')}
       WHERE id = $${i++} AND user_id = $${i}`,
      values
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async remove(
    userId: number,
    id: number | string
  ): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM wish_list WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const wishListService = WishListService.getInstance();
