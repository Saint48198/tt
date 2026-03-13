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

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Columns whose values may need timestamp conversion
const TIMESTAMP_COLUMNS = new Set([
  'last_visited',
  'created_at',
  'updated_at',
  'google_token_expiry',
]);

/**
 * Convert various SQLite date formats to valid PG TIMESTAMP values.
 */
function fixTimestamp(value: any): any {
  if (value === null || value === undefined) return null;
  if (value === '') return null;
  // Pure numeric → Unix timestamp (ms or seconds)
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
    const num = Number(value);
    const ms = num > 9999999999 ? num : num * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value !== 'string') return value;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  return value;
}

async function migrate() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const client = await pool.connect();

  try {
    for (const table of TABLES) {
      const exists = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
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

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        // If 'id' is null (e.g. SQLite ROWID-only tables like tags),
        // skip the id column so PG's SERIAL can auto-generate it.
        let rowColumns = columns;
        if (row['id'] === null || row['id'] === undefined) {
          rowColumns = columns.filter((c) => c !== 'id');
        }
        const quotedCols = rowColumns.map((c) => `"${c}"`).join(', ');
        const placeholders = rowColumns.map((_, i) => `$${i + 1}`).join(', ');

        const values = rowColumns.map((col) => {
          let v = row[col];
          if (TIMESTAMP_COLUMNS.has(col)) {
            v = fixTimestamp(v);
          }
          return v;
        });

        try {
          await client.query(
            `INSERT INTO ${table} (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
          inserted++;
        } catch (err: any) {
          skipped++;
          console.error(`  ⚠️  Skipped row in ${table}: ${err.message}`);
        }
      }

      // Reset the serial sequence so new INSERTs get the right id
      if (columns.includes('id')) {
        try {
          await client.query(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
          );
        } catch (err: any) {
          console.error(`  ⚠️  Could not reset sequence for ${table}: ${err.message}`);
        }
      }

      console.log(`✅ ${table}: ${inserted} inserted, ${skipped} skipped (of ${rows.length})`);
    }

    console.log('\n🎉 Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    sqlite.close();
    client.release();
    await pool.end();
  }
}

migrate();
