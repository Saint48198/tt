-- Create city_aliases table (1-to-many: one city has many aliases)
CREATE TABLE IF NOT EXISTS city_aliases (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
);

-- Unique constraint: no duplicate aliases per city
CREATE UNIQUE INDEX IF NOT EXISTS idx_city_aliases_unique
  ON city_aliases (city_id, LOWER(alias));

-- Index for fast lookups by alias name
CREATE INDEX IF NOT EXISTS idx_city_aliases_alias
  ON city_aliases (LOWER(alias));

