-- Add latitude and longitude columns to photos table for GPS EXIF data
ALTER TABLE photos ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

