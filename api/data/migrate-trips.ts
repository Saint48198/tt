import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker',
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migrating trips table to new schema...');

    // Check if the old 'destination' column exists
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'trips' AND column_name = 'destination'
    `);

    if (colCheck.rows.length > 0) {
      console.log('Old schema detected — migrating...');

      // Rename destination -> name
      await client.query(`ALTER TABLE trips RENAME COLUMN destination TO name`);
      console.log('  Renamed destination → name');

      // Drop old columns (startDate, endDate, countryId)
      await client.query(`ALTER TABLE trips DROP COLUMN IF EXISTS "startDate"`);
      await client.query(`ALTER TABLE trips DROP COLUMN IF EXISTS "endDate"`);
      await client.query(`ALTER TABLE trips DROP COLUMN IF EXISTS "countryId"`);
      console.log('  Dropped startDate, endDate, countryId');

      // Add plan JSONB column
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS plan JSONB NOT NULL DEFAULT '[]'::jsonb`);
      console.log('  Added plan JSONB column');

      // Add timestamp columns
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW()`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW()`);
      console.log('  Added created_date, updated_date');
    } else {
      // Check if the table even exists; if not, create it fresh
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'trips'
      `);

      if (tableCheck.rows.length === 0) {
        console.log('No trips table found — creating...');
        await client.query(`
          CREATE TABLE trips (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            notes TEXT,
            plan JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_date TIMESTAMP DEFAULT NOW(),
            updated_date TIMESTAMP DEFAULT NOW()
          );
        `);
        console.log('  Created trips table');
      } else {
        // Table exists with new schema already — just ensure columns exist
        await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS plan JSONB NOT NULL DEFAULT '[]'::jsonb`);
        await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW()`);
        await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW()`);
        console.log('Schema already up to date (or columns added)');
      }
    }

    console.log('Trips migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});

