-- Migration: Replace boolean type columns with many-to-many attraction_types

-- 1. Create the attraction_types table
CREATE TABLE IF NOT EXISTS attraction_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

-- 2. Seed default types
INSERT INTO attraction_types (name, slug) VALUES
  ('UNESCO', 'unesco'),
  ('National Park', 'national-park'),
  ('State Park', 'state-park')
ON CONFLICT (slug) DO NOTHING;

-- 3. Create junction table
CREATE TABLE IF NOT EXISTS attraction_type_assignments (
  attraction_id INTEGER NOT NULL,
  type_id INTEGER NOT NULL,
  FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
  FOREIGN KEY (type_id) REFERENCES attraction_types(id) ON DELETE CASCADE,
  PRIMARY KEY (attraction_id, type_id)
);

-- 4. Migrate existing boolean data
INSERT INTO attraction_type_assignments (attraction_id, type_id)
  SELECT a.id, t.id FROM attractions a, attraction_types t
  WHERE a.is_unesco = TRUE AND t.slug = 'unesco'
ON CONFLICT DO NOTHING;

INSERT INTO attraction_type_assignments (attraction_id, type_id)
  SELECT a.id, t.id FROM attractions a, attraction_types t
  WHERE a.is_national_park = TRUE AND t.slug = 'national-park'
ON CONFLICT DO NOTHING;

INSERT INTO attraction_type_assignments (attraction_id, type_id)
  SELECT a.id, t.id FROM attractions a, attraction_types t
  WHERE a.is_state_park = TRUE AND t.slug = 'state-park'
ON CONFLICT DO NOTHING;

-- 5. Drop old boolean columns
ALTER TABLE attractions DROP COLUMN IF EXISTS is_unesco;
ALTER TABLE attractions DROP COLUMN IF EXISTS is_national_park;
ALTER TABLE attractions DROP COLUMN IF EXISTS is_state_park;
