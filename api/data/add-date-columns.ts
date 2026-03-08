import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker',
});

const TABLES = ['countries', 'states', 'cities', 'attractions', 'photos'];
const COLUMNS = [
  { name: 'created_date', type: 'TIMESTAMP DEFAULT NOW()' },
  { name: 'updated_date', type: 'TIMESTAMP DEFAULT NOW()' },
  { name: 'disabled_date', type: 'TIMESTAMP' },
];

async function migrate() {
  const client = await pool.connect();
  try {
    for (const table of TABLES) {
      for (const col of COLUMNS) {
        const exists = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
          [table, col.name]
        );
        if (exists.rowCount === 0) {
          await client.query(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added ${col.name} to ${table}`);
        } else {
          console.log(`${col.name} already exists on ${table}, skipping`);
        }
      }
    }

    // Backfill created_date for existing rows that have NULL
    for (const table of TABLES) {
      await client.query(`UPDATE ${table} SET created_date = NOW() WHERE created_date IS NULL`);
      await client.query(`UPDATE ${table} SET updated_date = NOW() WHERE updated_date IS NULL`);
    }

    console.log('Migration completed successfully');
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
