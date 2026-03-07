-- Add optional state_id column to attractions table
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS state_id INTEGER REFERENCES states(id);

