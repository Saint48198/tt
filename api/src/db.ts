import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker',
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

/**
 * Async DB helper wrapping a pg Pool.
 *
 * Usage:
 *   const row  = await db.get<T>('SELECT … WHERE id = $1', [id]);
 *   const rows = await db.all<T>('SELECT …', []);
 *   const res  = await db.run('INSERT …', [val]);   // res.rowCount, res.rows
 *   await db.exec('CREATE TABLE …');
 */
export const db = {
  /** Return the first row or undefined */
  async get<T = any>(text: string, params: any[] = []): Promise<T | undefined> {
    const result = await pool.query(text, params);
    return result.rows[0] as T | undefined;
  },

  /** Return all rows */
  async all<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const result = await pool.query(text, params);
    return result.rows as T[];
  },

  /** Execute a statement (INSERT / UPDATE / DELETE). Returns rowCount + rows. */
  async run(text: string, params: any[] = []): Promise<{ rowCount: number; rows: any[] }> {
    const result = await pool.query(text, params);
    return { rowCount: result.rowCount ?? 0, rows: result.rows };
  },

  /** Execute raw SQL (DDL, multi-statement via single query). */
  async exec(text: string): Promise<void> {
    await pool.query(text);
  },

  /** Get the underlying pool for transactions */
  pool,
};
