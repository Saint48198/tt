/**
 * Migration script: SQLite → PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/trip_tracker \
 *   npx ts-node api/data/migrate-sqlite-to-pg.ts
 *
 * Prerequisites:
 *   1. PostgreSQL database created:  createdb trip_tracker
 *   2. Schema initialized:           npx ts-node api/data/init.ts
 *   3. SQLite database file exists at the path below.
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';

const SQLITE_PATH = path.resolve(__dirname, './trip-tracker.db');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker',
});

// Tables in dependency order (parents before children)
const TABLES = [
  'countries',
  'states',
  'cities',
  'attractions',
  'users',
  'roles',
  'user_roles',
  'user_google_accounts',
  'trips',
  'photos',
  'tags',
  'photo_tags',
  'user_tokens',
  'user_locations',
  'user_locations_messages',
];

async function migrate() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const client = await pool.connect();

  try {
    for (const table of TABLES) {
      // Check if table exists in SQLite
      const exists = sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        )
        .get(table);

      if (!exists) {
        console.log(`⏭  Skipping ${table} (not found in SQLite)`);
        continue;
      }

      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];

      if (rows.length === 0) {
        console.log(`⏭  Skipping ${table} (empty)`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      // Quote column names that are reserved words
      const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      await client.query('BEGIN');

      for (const row of rows) {
        const values = columns.map((col) => {
          const v = row[col];
          // Convert SQLite boolean integers to real booleans for PG boolean columns
          if (
            (col === 'is_unesco' || col === 'is_national_park') &&
            (v === 0 || v === 1)
          ) {
            return v === 1;
          }
          return v;
        });

        try {
          await client.query(
            `INSERT INTO ${table} (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
        } catch (err: any) {
          console.error(`  ❌ Error inserting into ${table}:`, err.message);
          console.error('     Row:', JSON.stringify(row));
        }
      }

      // Reset the serial sequence so new INSERTs get the right id
      if (columns.includes('id')) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
        );
      }

      await client.query('COMMIT');
      console.log(`✅ ${table}: ${rows.length} rows migrated`);
    }

    console.log('\n🎉 Migration complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    sqlite.close();
    client.release();
    await pool.end();
  }
}

migrate();

