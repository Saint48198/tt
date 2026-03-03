-- Backfill country_id for photos that have a country in their S3 key but no country_id set
-- The S3 key format is: uploads/{country-slug}/{uuid}.{ext}
-- This matches the slug against the countries table

UPDATE photos
SET country_id = c.id, updated_date = NOW()
FROM countries c
WHERE photos.country_id IS NULL
  AND photos.photo_id IS NOT NULL
  AND photos.photo_id LIKE 'uploads/%'
  AND LOWER(REPLACE(c.name, ' ', '-')) = SPLIT_PART(photos.photo_id, '/', 2);

