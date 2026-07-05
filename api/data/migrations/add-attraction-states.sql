-- =====================================================================
-- Migration: attractions ↔ states (one attraction can have many states)
--
-- Adds a many-to-many join table `attraction_state_assignments`
-- following the same pattern as `attraction_type_assignments`.
--
-- The existing `attractions.state_id` column is kept for backward
-- compatibility (photo geotagging, existing queries). Any non-null
-- values there are backfilled into the new join table so the new
-- table becomes the source of truth going forward.
--
-- Safe to re-run.
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------
-- 1. Join table
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attraction_state_assignments (
  attraction_id INTEGER NOT NULL,
  state_id      INTEGER NOT NULL,
  created_date  TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (attraction_id, state_id),
  FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
  FOREIGN KEY (state_id)      REFERENCES states(id)      ON DELETE CASCADE
);

-- Helpful lookup indexes (PK already covers (attraction_id, state_id)).
CREATE INDEX IF NOT EXISTS idx_attraction_state_assignments_state
  ON attraction_state_assignments (state_id);

CREATE INDEX IF NOT EXISTS idx_attraction_state_assignments_attraction
  ON attraction_state_assignments (attraction_id);

-- --------------------------------------------------------------
-- 2. Backfill from existing attractions.state_id
-- --------------------------------------------------------------
INSERT INTO attraction_state_assignments (attraction_id, state_id)
SELECT a.id, a.state_id
FROM attractions a
WHERE a.state_id IS NOT NULL
ON CONFLICT (attraction_id, state_id) DO NOTHING;

COMMIT;

-- =====================================================================
-- Notes for follow-up work (NOT executed here):
--
-- * `attractions.state_id` is retained so existing services
--   (attractionService.ts, photoService.ts) keep working. It should
--   be treated as the "primary" state for the attraction, with
--   additional states living in attraction_state_assignments.
--
-- * When those services are updated to read/write the join table
--   directly, this column can be dropped:
--
--     ALTER TABLE attractions DROP COLUMN state_id;
--
-- =====================================================================

-- Verify:
-- SELECT a.id, a.name, s.name AS state
-- FROM attraction_state_assignments asa
-- JOIN attractions a ON a.id = asa.attraction_id
-- JOIN states      s ON s.id = asa.state_id
-- ORDER BY a.name, s.name;

