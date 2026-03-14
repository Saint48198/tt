import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trip_tracker',
});

async function init() {
  const client = await pool.connect();
  try {
    // world_regions TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS world_regions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_date TIMESTAMP DEFAULT NOW()
      );
    `);

    // world_sub_regions TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS world_sub_regions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        world_region_id INTEGER NOT NULL,
        created_date TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (world_region_id) REFERENCES world_regions(id) ON DELETE CASCADE,
        UNIQUE (name, world_region_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_world_sub_regions_region
        ON world_sub_regions (world_region_id);
    `);

    // countries TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        alt_name TEXT,
        abbreviation TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        slug TEXT NOT NULL,
        region TEXT,
        sub_region TEXT,
        world_region_id INTEGER REFERENCES world_regions(id),
        world_sub_region_id INTEGER REFERENCES world_sub_regions(id),
        last_visited TIMESTAMP,
        geo_map_id TEXT NOT NULL UNIQUE,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW(),
        disabled_date TIMESTAMP
      );
    `);

    // country_aliases TABLE (1-to-many: one country has many aliases)
    await client.query(`
      CREATE TABLE IF NOT EXISTS country_aliases (
        id SERIAL PRIMARY KEY,
        country_id INTEGER NOT NULL,
        alias TEXT NOT NULL,
        created_date TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_country_aliases_unique
        ON country_aliases (country_id, LOWER(alias));
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_country_aliases_alias
        ON country_aliases (LOWER(alias));
    `);

    // trips TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        notes TEXT,
        plan JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW()
      );
    `);

    // states TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS states (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        abbr TEXT,
        geo_map_id TEXT,
        last_visited TIMESTAMP,
        country_id INTEGER NOT NULL,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW(),
        disabled_date TIMESTAMP,
        FOREIGN KEY (country_id) REFERENCES countries(id)
      );
    `);

    // cities TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        last_visited TIMESTAMP,
        state_id INTEGER,
        country_id INTEGER NOT NULL,
        wiki_term TEXT,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW(),
        disabled_date TIMESTAMP,
        FOREIGN KEY (state_id) REFERENCES states(id),
        FOREIGN KEY (country_id) REFERENCES countries(id)
      );
    `);

    // city_aliases TABLE (1-to-many: one city has many aliases)
    await client.query(`
      CREATE TABLE IF NOT EXISTS city_aliases (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL,
        alias TEXT NOT NULL,
        created_date TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_city_aliases_unique
        ON city_aliases (city_id, LOWER(alias));
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_city_aliases_alias
        ON city_aliases (LOWER(alias));
    `);

    // attractions TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS attractions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        country_id INTEGER NOT NULL,
        state_id INTEGER,
        wiki_term TEXT,
        last_visited TIMESTAMP,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW(),
        disabled_date TIMESTAMP,
        FOREIGN KEY (country_id) REFERENCES countries(id),
        FOREIGN KEY (state_id) REFERENCES states(id)
      );
    `);

    // attraction_types TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS attraction_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE
      );
    `);

    // Seed default attraction types
    await client.query(`
      INSERT INTO attraction_types (name, slug) VALUES
        ('UNESCO', 'unesco'),
        ('National Park', 'national-park'),
        ('State Park', 'state-park')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // attraction_type_assignments TABLE (many-to-many)
    await client.query(`
      CREATE TABLE IF NOT EXISTS attraction_type_assignments (
        attraction_id INTEGER NOT NULL,
        type_id INTEGER NOT NULL,
        FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
        FOREIGN KEY (type_id) REFERENCES attraction_types(id) ON DELETE CASCADE,
        PRIMARY KEY (attraction_id, type_id)
      );
    `);

    // users TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        google_access_token TEXT,
        google_refresh_token TEXT,
        google_token_expiry TIMESTAMP,
        profile_icon TEXT,
        instagram TEXT,
        portfolio_url TEXT,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW(),
        disabled_date TIMESTAMP
      );
    `);

    // roles TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
    `);

    // user_roles TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (role_id) REFERENCES roles (id),
        PRIMARY KEY (user_id, role_id)
      );
    `);

    // user_google_accounts TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_google_accounts (
        user_id INTEGER PRIMARY KEY,
        google_account_id TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // photos TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        city_id INTEGER,
        attraction_id INTEGER,
        state_id INTEGER,
        country_id INTEGER,
        caption TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        photo_id TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        original_filename TEXT,
        created_date TIMESTAMP DEFAULT NOW(),
        updated_date TIMESTAMP DEFAULT NOW(),
        disabled_date TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (city_id) REFERENCES cities(id),
        FOREIGN KEY (attraction_id) REFERENCES attractions(id),
        FOREIGN KEY (state_id) REFERENCES states(id),
        FOREIGN KEY (country_id) REFERENCES countries(id)
      );
    `);

    // tags TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE
      );
    `);

    // photo_tags TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS photo_tags (
        id SERIAL PRIMARY KEY,
        photo_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        UNIQUE(photo_id, tag_id)
      );
    `);

    // user_tokens TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // user_locations TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_locations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // user_locations_messages TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_locations_messages (
        id SERIAL PRIMARY KEY,
        check_in_id INTEGER NOT NULL,
        user_id INTEGER,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (check_in_id) REFERENCES user_locations(id) ON DELETE CASCADE
      );
    `);

    // ── Triggers ──
    // PostgreSQL triggers require a function + trigger pair

    // Trigger function: update country last_visited from attractions
    await client.query(`
      CREATE OR REPLACE FUNCTION update_country_last_visited_from_attraction()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE countries
        SET last_visited = (
          SELECT MAX(last_visited)
          FROM attractions
          WHERE country_id = NEW.country_id
        )
        WHERE id = NEW.country_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_update_country_last_visited_from_attraction ON attractions;
      CREATE TRIGGER trg_update_country_last_visited_from_attraction
      AFTER INSERT ON attractions
      FOR EACH ROW
      EXECUTE FUNCTION update_country_last_visited_from_attraction();
    `);

    // Trigger function: update country last_visited from cities
    await client.query(`
      CREATE OR REPLACE FUNCTION update_country_last_visited_from_city()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE countries
        SET last_visited = (
          SELECT MAX(last_visited)
          FROM cities
          WHERE country_id = NEW.country_id
        )
        WHERE id = NEW.country_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_update_country_last_visited_from_city ON cities;
      CREATE TRIGGER trg_update_country_last_visited_from_city
      AFTER INSERT ON cities
      FOR EACH ROW
      EXECUTE FUNCTION update_country_last_visited_from_city();
    `);

    // Trigger function: update country last_visited from states
    await client.query(`
      CREATE OR REPLACE FUNCTION update_country_last_visited_from_state()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE countries
        SET last_visited = (
          SELECT MAX(last_visited)
          FROM (
            SELECT last_visited FROM states WHERE country_id = NEW.country_id
            UNION ALL
            SELECT last_visited FROM cities WHERE country_id = NEW.country_id
          ) sub
        )
        WHERE id = NEW.country_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_update_country_last_visited_from_state ON states;
      CREATE TRIGGER trg_update_country_last_visited_from_state
      AFTER UPDATE ON states
      FOR EACH ROW
      WHEN (OLD.last_visited IS DISTINCT FROM NEW.last_visited)
      EXECUTE FUNCTION update_country_last_visited_from_state();
    `);

    // Trigger function: update state last_visited from cities
    await client.query(`
      CREATE OR REPLACE FUNCTION update_state_last_visited_from_city()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.state_id IS NOT NULL THEN
          UPDATE states
          SET last_visited = (
            SELECT MAX(last_visited)
            FROM cities
            WHERE state_id = NEW.state_id
          )
          WHERE id = NEW.state_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_update_state_last_visited_from_city ON cities;
      CREATE TRIGGER trg_update_state_last_visited_from_city
      AFTER UPDATE ON cities
      FOR EACH ROW
      WHEN (OLD.last_visited IS DISTINCT FROM NEW.last_visited)
      EXECUTE FUNCTION update_state_last_visited_from_city();
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
