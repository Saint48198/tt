-- Add state_id column to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS state_id INTEGER REFERENCES states(id);

-- Backfill state_id from city's state_id where possible
UPDATE photos
SET state_id = cities.state_id
FROM cities
WHERE photos.city_id = cities.id
  AND cities.state_id IS NOT NULL
  AND photos.state_id IS NULL;

