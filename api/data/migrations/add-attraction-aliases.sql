-- Migration: add attraction_aliases table
-- Mirrors the city_aliases table structure

CREATE TABLE IF NOT EXISTS attraction_aliases (
  id           SERIAL PRIMARY KEY,
  attraction_id INTEGER NOT NULL,
  alias        TEXT NOT NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attraction_aliases_unique
  ON attraction_aliases (attraction_id, LOWER(alias));

CREATE INDEX IF NOT EXISTS idx_attraction_aliases_alias
  ON attraction_aliases (LOWER(alias));

