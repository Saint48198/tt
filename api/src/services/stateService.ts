import { db } from '../db';
import { CountRow } from '@shared/types';

interface State {
  id: number;
  name: string;
  abbr?: string;
  country_id: number;
  last_visited?: string;
  country_name: string;
}

interface ListStatesOptions {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: string;
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
  ] as const;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): StateService {
    if (!StateService.instance) {
      StateService.instance = new StateService();
    }
    return StateService.instance;
  }

  /**
   * Get all states or paginated states with sorting
   */
  public getStates(options: ListStatesOptions): {
    states: State[];
    total: number;
    page?: number;
    limit?: number;
  } {
    const {
      page = 1,
      limit = 10,
      all = false,
      sortBy = 'states.name',
      sortOrder = 'asc',
    } = options;

    let sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();

    if (sortByStr === 'name') {
      sortByStr = 'states.name';
    }

    if (!this.isValidColumn(sortByStr)) {
      throw new Error('Invalid sort column.');
    }

    if (!['asc', 'desc'].includes(sortOrderStr)) {
      throw new Error('Invalid sort order.');
    }

    if (all) {
      const states = db
        .prepare(
          `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                  countries.name as country_name
           FROM states
           JOIN countries ON states.country_id = countries.id
           ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`
        )
        .all() as State[];

      return {
        total: states.length,
        states,
      };
    }

    const offset = (page - 1) * limit;

    const totalRow = db.prepare('SELECT COUNT(*) AS count FROM states').get() as CountRow;
    const total = totalRow.count as number;

    const states = db
      .prepare(
        `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                countries.name as country_name
         FROM states
         JOIN countries ON states.country_id = countries.id
         ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as State[];

    return {
      total,
      states,
      page,
      limit,
    };
  }

  private isValidColumn(column: string): boolean {
    return (this.validColumns as readonly string[]).includes(column);
  }

  /**
   * Get a state by ID
   */
  public getStateById(id: number): State | undefined {
    return db
      .prepare(
        `SELECT states.id, states.name, states.abbr, states.country_id, states.last_visited,
                countries.name as country_name
         FROM states
         JOIN countries ON states.country_id = countries.id
         WHERE states.id = ?`
      )
      .get(id) as State | undefined;
  }

  /**
   * Create a new state
   */
  public createState(data: CreateStateData): { id: number } {
    const { name, abbr, country_id, last_visited } = data;

    const result = db
      .prepare(
        'INSERT INTO states (name, abbr, country_id, last_visited) VALUES (?, ?, ?, ?)'
      )
      .run(name, abbr || null, country_id, last_visited);

    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Update a state
   */
  public updateState(
    id: number,
    data: UpdateStateData
  ): { success: boolean; changes: number } {
    const { name, abbr, country_id, last_visited } = data;

    const result = db
      .prepare(
        'UPDATE states SET name = ?, abbr = ?, country_id = ?, last_visited = ? WHERE id = ?'
      )
      .run(name, abbr || null, country_id, last_visited, id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete a state
   */
  public deleteState(id: number): { success: boolean; changes: number } {
    const result = db.prepare('DELETE FROM states WHERE id = ?').run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }
}

export const stateService = StateService.getInstance();



