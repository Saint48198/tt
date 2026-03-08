import { db } from '../db';
import { CountRow } from '@shared/types';

interface State {
  id: number;
  name: string;
  abbr?: string;
  country_id: number;
  last_visited?: string;
  country_name: string;
  created_date?: string;
  updated_date?: string;
  disabled_date?: string;
}

interface ListStatesOptions {
  country_id?: number;
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: string;
  includeDisabled?: boolean;
}

interface CreateStateData {
  name: string;
  abbr?: string;
  country_id: number;
  last_visited?: string;
}
interface UpdateStateData {
  name?: string;
  abbr?: string;
  country_id?: number;
  last_visited?: string;
}

class StateService {
  private static instance: StateService;
  private validColumns = [
    'states.name',
    'abbr',
    'country_id',
    'last_visited',
    'country_name',
    'created_date',
    'updated_date',
    'disabled_date',
  ] as const;

  private constructor() {}

  public static getInstance(): StateService {
    if (!StateService.instance) {
      StateService.instance = new StateService();
    }
    return StateService.instance;
  }

  private isValidColumn(column: string): boolean {
    return (this.validColumns as readonly string[]).includes(column);
  }

  public async getStates(options: ListStatesOptions): Promise<{
    states: State[];
    total: number;
    page?: number;
    limit?: number;
  }> {
    const {
      country_id,
      page = 1,
      limit = 10,
      all = false,
      sortBy = 'states.name',
      sortOrder = 'asc',
      includeDisabled = false,
    } = options;
    let sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();
    if (sortByStr === 'name') sortByStr = 'states.name';
    if (!this.isValidColumn(sortByStr)) throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (!includeDisabled) {
      whereClauses.push('states.disabled_date IS NULL');
    }
    if (country_id !== undefined && !Number.isNaN(country_id)) {
      whereClauses.push(`states.country_id = $${paramIdx++}`);
      params.push(country_id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const baseSelect = `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                                states.created_date, states.updated_date, states.disabled_date,
                                countries.name as country_name
                         FROM states JOIN countries ON states.country_id = countries.id
                         ${whereClause}`;

    if (all) {
      const states = await db.all<State>(
        `${baseSelect} ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`,
        params
      );
      return { total: states.length, states };
    }

    const offset = (page - 1) * limit;
    const countQuery = `SELECT COUNT(*) AS count FROM states JOIN countries ON states.country_id = countries.id ${whereClause}`;
    const totalRow = await db.get<{ count: string }>(countQuery, params);
    const states = await db.all<State>(
      `${baseSelect} ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );
    return { total: Number(totalRow?.count ?? 0), states, page, limit };
  }

  public async getStateById(id: number): Promise<State | undefined> {
    return db.get<State>(
      `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
              states.created_date, states.updated_date, states.disabled_date,
              countries.name as country_name
       FROM states JOIN countries ON states.country_id = countries.id WHERE states.id = $1 AND states.disabled_date IS NULL`,
      [id]
    );
  }

  public async createState(data: CreateStateData): Promise<{ id: number }> {
    const { name, abbr, country_id, last_visited } = data;
    const result = await db.run(
      'INSERT INTO states (name, abbr, country_id, last_visited) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, abbr || null, country_id, last_visited]
    );
    return { id: result.rows[0].id };
  }

  public async updateState(
    id: number,
    data: UpdateStateData
  ): Promise<{ success: boolean; changes: number }> {
    const { name, abbr, country_id, last_visited } = data;
    const result = await db.run(
      'UPDATE states SET name=$1, abbr=$2, country_id=$3, last_visited=$4, updated_date=NOW() WHERE id=$5',
      [name, abbr || null, country_id, last_visited, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  public async deleteState(id: number): Promise<{ success: boolean; changes: number }> {
    const result = await db.run(
      'UPDATE states SET disabled_date = NOW() WHERE id = $1 AND disabled_date IS NULL',
      [id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const stateService = StateService.getInstance();
