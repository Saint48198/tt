/**
 * backfill-last-visited.cjs
 *
 * Updates `last_visited` on cities, attractions, states, and countries
 * from the MAX photo date of photos assigned to each entity, but only when:
 *   - the entity has no last_visited date, OR
 *   - the entity's last_visited date is earlier than the newest photo
 *
 * Uses COALESCE(created_date, created_at) per photo — preferring the EXIF
 * capture date and falling back to the upload timestamp.
 *
 * States  → photos tagged directly to the state  OR via a city/attraction in that state
 * Countries → photos tagged directly to the country OR via a city/attraction/state in that country
 *
 * Usage:
 *   node api/data/backfill-last-visited.cjs            # dry-run (no writes)
 *   node api/data/backfill-last-visited.cjs --apply    # apply changes
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker',
});

const DRY_RUN = !process.argv.includes('--apply');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(val) {
  return val
    ? new Date(val).toISOString().slice(0, 19).replace('T', ' ')
    : '(none)';
}

function printTable(rows) {
  console.log(
    `${'ID'.padEnd(6)} ${'Name'.padEnd(32)} ${'Photos'.padEnd(8)} ${'Current last_visited'.padEnd(26)} New last_visited`
  );
  console.log('-'.repeat(108));
  for (const row of rows) {
    const id      = String(row.id).padEnd(6);
    const name    = String(row.name).slice(0, 31).padEnd(32);
    const count   = String(row.photo_count).padEnd(8);
    const current = fmtDate(row.current_last_visited).padEnd(26);
    const next    = fmtDate(row.max_photo_date);
    console.log(`${id} ${name} ${count} ${current} ${next}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Direct-FK entities: cities & attractions
// ---------------------------------------------------------------------------
const DIRECT_ENTITIES = [
  { table: 'cities',      photoCol: 'city_id',      label: 'Cities' },
  { table: 'attractions', photoCol: 'attraction_id', label: 'Attractions' },
];

async function previewDirect(client, entity) {
  const { table, photoCol } = entity;
  const r = await client.query(`
    SELECT
      e.id,
      e.name,
      e.last_visited                                       AS current_last_visited,
      MAX(COALESCE(p.created_date, p.created_at))         AS max_photo_date,
      COUNT(p.id)                                         AS photo_count
    FROM ${table} e
    INNER JOIN photos p ON p.${photoCol} = e.id
    WHERE p.disabled_date IS NULL
      AND COALESCE(p.created_date, p.created_at) IS NOT NULL
    GROUP BY e.id, e.name, e.last_visited
    HAVING e.last_visited IS NULL
        OR e.last_visited < MAX(COALESCE(p.created_date, p.created_at))
    ORDER BY e.name;
  `);
  return r.rows;
}

async function applyDirect(client, entity) {
  const { table, photoCol } = entity;
  const r = await client.query(`
    UPDATE ${table}
    SET last_visited = pd.max_photo_date,
        updated_date = NOW()
    FROM (
      SELECT ${photoCol} AS entity_id,
             MAX(COALESCE(created_date, created_at)) AS max_photo_date
      FROM photos
      WHERE ${photoCol} IS NOT NULL
        AND disabled_date IS NULL
        AND COALESCE(created_date, created_at) IS NOT NULL
      GROUP BY ${photoCol}
    ) pd
    WHERE ${table}.id = pd.entity_id
      AND (${table}.last_visited IS NULL
           OR ${table}.last_visited < pd.max_photo_date);
  `);
  return r.rowCount;
}

// ---------------------------------------------------------------------------
// Rollup entity: states
// Photos count if they are tagged to the state directly OR via a city/attraction in that state
// ---------------------------------------------------------------------------
async function previewStates(client) {
  const r = await client.query(`
    SELECT
      s.id,
      s.name,
      s.last_visited                                       AS current_last_visited,
      MAX(COALESCE(p.created_date, p.created_at))         AS max_photo_date,
      COUNT(p.id)                                         AS photo_count
    FROM states s
    INNER JOIN photos p
      ON  p.state_id = s.id
      OR  (p.city_id       IS NOT NULL AND p.city_id       IN (SELECT id FROM cities       WHERE state_id = s.id))
      OR  (p.attraction_id IS NOT NULL AND p.attraction_id IN (SELECT id FROM attractions  WHERE state_id = s.id))
    WHERE p.disabled_date IS NULL
      AND COALESCE(p.created_date, p.created_at) IS NOT NULL
    GROUP BY s.id, s.name, s.last_visited
    HAVING s.last_visited IS NULL
        OR s.last_visited < MAX(COALESCE(p.created_date, p.created_at))
    ORDER BY s.name;
  `);
  return r.rows;
}

async function applyStates(client) {
  const r = await client.query(`
    UPDATE states
    SET last_visited = pd.max_photo_date,
        updated_date = NOW()
    FROM (
      SELECT s.id AS entity_id,
             MAX(COALESCE(p.created_date, p.created_at)) AS max_photo_date
      FROM states s
      INNER JOIN photos p
        ON  p.state_id = s.id
        OR  (p.city_id       IS NOT NULL AND p.city_id       IN (SELECT id FROM cities       WHERE state_id = s.id))
        OR  (p.attraction_id IS NOT NULL AND p.attraction_id IN (SELECT id FROM attractions  WHERE state_id = s.id))
      WHERE p.disabled_date IS NULL
        AND COALESCE(p.created_date, p.created_at) IS NOT NULL
      GROUP BY s.id
    ) pd
    WHERE states.id = pd.entity_id
      AND (states.last_visited IS NULL
           OR states.last_visited < pd.max_photo_date);
  `);
  return r.rowCount;
}

// ---------------------------------------------------------------------------
// Rollup entity: countries
// Photos count if tagged to the country directly OR via a city/attraction/state in that country
// ---------------------------------------------------------------------------
async function previewCountries(client) {
  const r = await client.query(`
    SELECT
      c.id,
      c.name,
      c.last_visited                                       AS current_last_visited,
      MAX(COALESCE(p.created_date, p.created_at))         AS max_photo_date,
      COUNT(p.id)                                         AS photo_count
    FROM countries c
    INNER JOIN photos p
      ON  p.country_id = c.id
      OR  (p.city_id       IS NOT NULL AND p.city_id       IN (SELECT id FROM cities       WHERE country_id = c.id))
      OR  (p.attraction_id IS NOT NULL AND p.attraction_id IN (SELECT id FROM attractions  WHERE country_id = c.id))
      OR  (p.state_id      IS NOT NULL AND p.state_id      IN (SELECT id FROM states       WHERE country_id = c.id))
    WHERE p.disabled_date IS NULL
      AND COALESCE(p.created_date, p.created_at) IS NOT NULL
    GROUP BY c.id, c.name, c.last_visited
    HAVING c.last_visited IS NULL
        OR c.last_visited < MAX(COALESCE(p.created_date, p.created_at))
    ORDER BY c.name;
  `);
  return r.rows;
}

async function applyCountries(client) {
  const r = await client.query(`
    UPDATE countries
    SET last_visited = pd.max_photo_date,
        updated_date = NOW()
    FROM (
      SELECT c.id AS entity_id,
             MAX(COALESCE(p.created_date, p.created_at)) AS max_photo_date
      FROM countries c
      INNER JOIN photos p
        ON  p.country_id = c.id
        OR  (p.city_id       IS NOT NULL AND p.city_id       IN (SELECT id FROM cities       WHERE country_id = c.id))
        OR  (p.attraction_id IS NOT NULL AND p.attraction_id IN (SELECT id FROM attractions  WHERE country_id = c.id))
        OR  (p.state_id      IS NOT NULL AND p.state_id      IN (SELECT id FROM states       WHERE country_id = c.id))
      WHERE p.disabled_date IS NULL
        AND COALESCE(p.created_date, p.created_at) IS NOT NULL
      GROUP BY c.id
    ) pd
    WHERE countries.id = pd.entity_id
      AND (countries.last_visited IS NULL
           OR countries.last_visited < pd.max_photo_date);
  `);
  return r.rowCount;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  const client = await pool.connect();
  try {
    console.log(`\n=== Backfill last_visited from photos ===`);
    console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (pass --apply to write changes)' : 'APPLY'}\n`);

    let grandTotal = 0;

    // ── Cities & Attractions (direct FK join) ──
    for (const entity of DIRECT_ENTITIES) {
      const rows = await previewDirect(client, entity);
      if (rows.length === 0) {
        console.log(`✅  ${entity.label}: all last_visited dates are already up to date.\n`);
        continue;
      }
      console.log(`📋  ${entity.label} — ${rows.length} record(s) to update:\n`);
      printTable(rows);
      if (!DRY_RUN) {
        const n = await applyDirect(client, entity);
        console.log(`   ✅  Updated ${n} ${entity.label.toLowerCase()} record(s).\n`);
        grandTotal += n;
      }
    }

    // ── States (rollup: direct + cities + attractions within state) ──
    {
      const rows = await previewStates(client);
      if (rows.length === 0) {
        console.log(`✅  States: all last_visited dates are already up to date.\n`);
      } else {
        console.log(`📋  States — ${rows.length} record(s) to update (includes photos via cities/attractions within each state):\n`);
        printTable(rows);
        if (!DRY_RUN) {
          const n = await applyStates(client);
          console.log(`   ✅  Updated ${n} state record(s).\n`);
          grandTotal += n;
        }
      }
    }

    // ── Countries (rollup: direct + cities + attractions + states within country) ──
    {
      const rows = await previewCountries(client);
      if (rows.length === 0) {
        console.log(`✅  Countries: all last_visited dates are already up to date.\n`);
      } else {
        console.log(`📋  Countries — ${rows.length} record(s) to update (includes photos via cities/attractions/states within each country):\n`);
        printTable(rows);
        if (!DRY_RUN) {
          const n = await applyCountries(client);
          console.log(`   ✅  Updated ${n} country record(s).\n`);
          grandTotal += n;
        }
      }
    }

    if (DRY_RUN) {
      console.log(`⚠️  DRY-RUN — no changes written. Re-run with --apply to commit.\n`);
    } else {
      console.log(`✅  Done. Total records updated: ${grandTotal}\n`);
    }
  } catch (err) {
    console.error('\n❌  Error during backfill:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
