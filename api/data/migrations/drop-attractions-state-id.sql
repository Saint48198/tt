-- =====================================================================
-- Migration: drop legacy attractions.state_id column
--
-- Prerequisite: `add-attraction-states.sql` has already been run
-- (creates attraction_state_assignments and backfills existing values).
--
-- All application code (attractionService.ts, photoService.ts) now
-- reads state assignments exclusively from
-- attraction_state_assignments, so this column is safe to drop.
--
-- Safe to re-run (uses IF EXISTS).
-- =====================================================================

BEGIN;

-- Final safety-net backfill in case any rows were added after the
-- initial migration but before this one runs. No-op if already synced.
INSERT INTO attraction_state_assignments (attraction_id, state_id)
SELECT a.id, a.state_id
FROM attractions a
WHERE a.state_id IS NOT NULL
ON CONFLICT (attraction_id, state_id) DO NOTHING;

-- Drop the column (also drops its FK constraint implicitly).
ALTER TABLE attractions DROP COLUMN IF EXISTS state_id;

COMMIT;

