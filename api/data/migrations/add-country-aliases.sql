-- Create country_aliases table (1-to-many: one country has many aliases)
CREATE TABLE IF NOT EXISTS country_aliases (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

-- Unique constraint: no duplicate aliases per country
CREATE UNIQUE INDEX IF NOT EXISTS idx_country_aliases_unique
  ON country_aliases (country_id, LOWER(alias));

-- Index for fast lookups by alias name
CREATE INDEX IF NOT EXISTS idx_country_aliases_alias
  ON country_aliases (LOWER(alias));

