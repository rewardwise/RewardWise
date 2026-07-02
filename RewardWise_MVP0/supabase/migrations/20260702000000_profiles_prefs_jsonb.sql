-- Per-user preferences bag for the Profile > Preferences UI (8b-profile).
-- Currently holds search defaults, e.g.
--   { "search_defaults": { "cabin": "economy", "travelers": 1, "trip_type": "roundtrip" } }
-- Nullable + additive → safe under the auto-apply workflow's deploy window (new
-- code reads it defensively and falls back to hardcoded defaults on null/error,
-- so a brief window where the column is absent never throws). Existing rows get
-- prefs = NULL. RLS already covers profiles (user-scoped select/insert/update),
-- so no policy change is needed for a new column.
--
-- Rollback: ALTER TABLE "public"."profiles" DROP COLUMN IF EXISTS "prefs";
ALTER TABLE "public"."profiles"
    ADD COLUMN IF NOT EXISTS "prefs" "jsonb" DEFAULT NULL;
