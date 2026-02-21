const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/trip_tracker' });

async function migrate() {
  const client = await pool.connect();
  try {
    const tables = ['countries', 'states', 'cities', 'attractions', 'photos', 'users'];
    const cols = [
      { name: 'created_date', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'updated_date', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'disabled_date', type: 'TIMESTAMP' },
    ];
    for (const t of tables) {
      for (const c of cols) {
        try {
          await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${c.name} ${c.type}`);
          console.log(`OK: ${c.name} on ${t}`);
        } catch (e) {
          console.log(`SKIP: ${c.name} on ${t} - ${e.message}`);
        }
      }
      await client.query(`UPDATE ${t} SET created_date = NOW() WHERE created_date IS NULL`);
      await client.query(`UPDATE ${t} SET updated_date = NOW() WHERE updated_date IS NULL`);
    }
    console.log('Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}
migrate().catch(e => { console.error(e); process.exit(1); });

