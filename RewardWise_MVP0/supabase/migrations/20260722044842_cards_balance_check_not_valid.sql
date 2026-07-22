-- Recurrence stop for the x1000 balance-debris incident (2026-07-22 audit):
-- wallet writes go browser -> Supabase directly under RLS, the backend
-- /wallet route is a stub, and no DB constraint existed — so the UI cap was
-- the only gate and it is bypassable by construction.
--
-- NOT VALID: enforces on all NEW writes and updates immediately, without
-- validating existing rows (one 200,000,000 row + debris still stored; the
-- cleanup is a separately-approved, reversible pass). Run
--   ALTER TABLE public.cards VALIDATE CONSTRAINT cards_points_balance_range;
-- ONLY after that cleanup lands.
--
-- Boundary is EXCLUSIVE at 50,000,000: the app-side check was `> max`, which
-- let exactly-50M garbage through (observed in production).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cards_points_balance_range'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_points_balance_range
      CHECK (points_balance >= 0 AND points_balance < 50000000)
      NOT VALID;
  END IF;
END $$;
