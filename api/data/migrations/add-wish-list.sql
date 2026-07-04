-- Wish list of future destinations: countries, cities, and attractions
-- Each wish belongs to a single user.
CREATE TABLE IF NOT EXISTS wish_list (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('country', 'city', 'attraction')),
  name TEXT NOT NULL,
  country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  attraction_id INTEGER REFERENCES attractions(id) ON DELETE SET NULL,
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW()
);

-- If the table existed prior to this migration without user_id, add it now.
ALTER TABLE wish_list
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_wish_list_user ON wish_list (user_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_type ON wish_list (type);
CREATE INDEX IF NOT EXISTS idx_wish_list_priority
  ON wish_list (priority DESC, created_date DESC);


