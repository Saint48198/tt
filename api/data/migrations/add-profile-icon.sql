-- Add profile_icon column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_icon TEXT;

-- Add instagram column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Add portfolio_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

