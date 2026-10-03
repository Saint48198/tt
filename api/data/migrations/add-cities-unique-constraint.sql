-- =====================================================================
-- Migration: prevent duplicate cities
--
-- Enforces uniqueness on (LOWER(name), country_id, state_id) using
-- COALESCE so NULL state_id values still collide with each other.
--
-- Application-level validation lives in cityService.createCity /
-- updateCity (throws DuplicateCityError → HTTP 409). This index is
-- the DB-level safety net.
--
-- Only enforced for non-disabled cities so soft-deleted rows don't
-- block re-adding the same city later.
-- =====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_unique_name_country_state
  ON cities (LOWER(name), country_id, COALESCE(state_id, 0))
  WHERE disabled_date IS NULL;

