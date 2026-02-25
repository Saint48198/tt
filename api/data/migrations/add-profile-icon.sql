-- Add profile_icon column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_icon TEXT;

