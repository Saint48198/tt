-- Add region and sub_region columns to countries table
ALTER TABLE countries ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE countries ADD COLUMN IF NOT EXISTS sub_region TEXT;

-- Create indexes for filtering/sorting by region
CREATE INDEX IF NOT EXISTS idx_countries_region ON countries (region);
CREATE INDEX IF NOT EXISTS idx_countries_sub_region ON countries (sub_region);

