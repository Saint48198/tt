-- World Regions & Sub-Regions Tables
-- Relationship: world_region 1→N world_sub_region, countries FK → world_region & world_sub_region

CREATE TABLE IF NOT EXISTS world_regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_date TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_sub_regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  world_region_id INTEGER NOT NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (world_region_id) REFERENCES world_regions(id) ON DELETE CASCADE,
  UNIQUE (name, world_region_id)
);

CREATE INDEX IF NOT EXISTS idx_world_sub_regions_region ON world_sub_regions (world_region_id);

-- Seed regions
INSERT INTO world_regions (name) VALUES
  ('Africa'), ('Asia'), ('Europe'), ('North America'),
  ('South America'), ('Oceania'), ('Antarctica')
ON CONFLICT (name) DO NOTHING;

-- Seed sub-regions
INSERT INTO world_sub_regions (name, world_region_id) VALUES
  ('Northern Africa',              (SELECT id FROM world_regions WHERE name = 'Africa')),
  ('Sub-Saharan Africa',           (SELECT id FROM world_regions WHERE name = 'Africa')),
  ('East Asia',                    (SELECT id FROM world_regions WHERE name = 'Asia')),
  ('South Asia',                   (SELECT id FROM world_regions WHERE name = 'Asia')),
  ('Southeast Asia',               (SELECT id FROM world_regions WHERE name = 'Asia')),
  ('Central Asia',                 (SELECT id FROM world_regions WHERE name = 'Asia')),
  ('Southwest Asia (Middle East)', (SELECT id FROM world_regions WHERE name = 'Asia')),
  ('Eastern Europe',               (SELECT id FROM world_regions WHERE name = 'Europe')),
  ('Western Europe',               (SELECT id FROM world_regions WHERE name = 'Europe')),
  ('Northern Europe',              (SELECT id FROM world_regions WHERE name = 'Europe')),
  ('Southern Europe',              (SELECT id FROM world_regions WHERE name = 'Europe')),
  ('Central Europe',               (SELECT id FROM world_regions WHERE name = 'Europe')),
  ('Melanesia',                    (SELECT id FROM world_regions WHERE name = 'Oceania')),
  ('Micronesia',                   (SELECT id FROM world_regions WHERE name = 'Oceania')),
  ('Polynesia',                    (SELECT id FROM world_regions WHERE name = 'Oceania'))
ON CONFLICT (name, world_region_id) DO NOTHING;

-- Add FK columns to countries
ALTER TABLE countries ADD COLUMN IF NOT EXISTS world_region_id INTEGER REFERENCES world_regions(id);
ALTER TABLE countries ADD COLUMN IF NOT EXISTS world_sub_region_id INTEGER REFERENCES world_sub_regions(id);

CREATE INDEX IF NOT EXISTS idx_countries_world_region_id ON countries (world_region_id);
CREATE INDEX IF NOT EXISTS idx_countries_world_sub_region_id ON countries (world_sub_region_id);

