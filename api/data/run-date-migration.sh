#!/bin/bash
PSQL=/opt/homebrew/Cellar/postgresql@16/16.12/bin/psql
DB="postgresql://localhost:5432/trip_tracker"

$PSQL "$DB" <<'EOSQL'
ALTER TABLE countries ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW();
ALTER TABLE countries ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW();
ALTER TABLE countries ADD COLUMN IF NOT EXISTS disabled_date TIMESTAMP;
ALTER TABLE states ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW();
ALTER TABLE states ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW();
ALTER TABLE states ADD COLUMN IF NOT EXISTS disabled_date TIMESTAMP;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW();
ALTER TABLE cities ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW();
ALTER TABLE cities ADD COLUMN IF NOT EXISTS disabled_date TIMESTAMP;
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW();
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW();
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS disabled_date TIMESTAMP;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT NOW();
ALTER TABLE photos ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW();
ALTER TABLE photos ADD COLUMN IF NOT EXISTS disabled_date TIMESTAMP;
UPDATE countries SET created_date = NOW() WHERE created_date IS NULL;
UPDATE countries SET updated_date = NOW() WHERE updated_date IS NULL;
UPDATE states SET created_date = NOW() WHERE created_date IS NULL;
UPDATE states SET updated_date = NOW() WHERE updated_date IS NULL;
UPDATE cities SET created_date = NOW() WHERE created_date IS NULL;
UPDATE cities SET updated_date = NOW() WHERE updated_date IS NULL;
UPDATE attractions SET created_date = NOW() WHERE created_date IS NULL;
UPDATE attractions SET updated_date = NOW() WHERE updated_date IS NULL;
UPDATE photos SET created_date = NOW() WHERE created_date IS NULL;
UPDATE photos SET updated_date = NOW() WHERE updated_date IS NULL;
EOSQL

echo "Migration exit code: $?"

