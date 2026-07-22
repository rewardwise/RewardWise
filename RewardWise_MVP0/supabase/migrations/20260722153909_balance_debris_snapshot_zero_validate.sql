-- x1000-era balance-debris cleanup (operator-approved 2026-07-22).
-- Order: SNAPSHOT -> ZERO -> VALIDATE. Reversible by design: full original
-- rows are copied to cards_balance_snapshot_20260722 before any write, and
-- nothing is hard-deleted. Restore = UPDATE cards SET points_balance =
-- s.points_balance FROM snapshot s WHERE cards.id = s.id.
--
-- Provenance was investigated and is INFERRED only (no updated_at, no input
-- audit trail, one row at 1,900,005 proves mixed provenance), so
-- divide-by-1000 was ruled out as fabrication. Zeroing moves the affected
-- accounts from confidently-wrong to honestly wallet-blind.
--
-- The 16 row ids below were captured read-only on 2026-07-22 against
-- production and reviewed by the operator:
--   owner account (sarabjit.nagi, ALL 12 rows — operator: "zero all twelve"):
--     b644bc1c 0 | e22697f8 1,000,000 | b490be0f 1,900,000 | 094a3a50 1,900,005
--     f0cbb1d8 0 | 1208e376 0 | 9f1ba83e 0 | 1a3ad46c 1,000,000
--     90d50bb2 1,000,000 | 1ed431a2 1,000,000 | c1dd598e 16,000 | 84346602 10,000
--   real accounts (flagged debris rows only):
--     anushagsk01:   c5e13f3a 50,000,000 | 96c29254 200,000,000
--     anushagsk2001: 91e1ec17 2,000,000
--     ajsipsy.11:    b4bbc83a 2,000,000

DO $$
DECLARE
  zero_ids uuid[] := ARRAY[
    'b644bc1c-72b4-48e6-ba41-23df8e4f5ea3',
    'e22697f8-9f9e-4d18-90a1-09f1dc8760f8',
    'b490be0f-ed35-4dc7-ab2a-c030265d082e',
    '094a3a50-dbeb-4a2a-8bf6-02d5974e765e',
    'f0cbb1d8-9869-4e5c-8baf-c3fee19d8352',
    '1208e376-8e86-48e4-bc47-19755d5d4b20',
    '9f1ba83e-cf3c-4a12-aed6-3c015d06f10e',
    '1a3ad46c-725f-4ae1-8d6d-3ac37416c958',
    '90d50bb2-49f6-4474-b729-157e836635e8',
    '1ed431a2-3ee7-43d7-b396-44e96204cf1c',
    'c1dd598e-d335-493a-81ad-9a5da148bade',
    '84346602-fce5-4c3d-9a26-d00250166d34',
    'c5e13f3a-fc22-4df1-99ff-e6a4d321dc10',
    '96c29254-7c49-4470-8ebe-b348c14b5989',
    '91e1ec17-0bf8-489b-a876-07b21f89b8a6',
    'b4bbc83a-a817-4b90-bb1a-c688f97f629c'
  ]::uuid[];
BEGIN
  -- 1. SNAPSHOT (idempotent: skip if the snapshot table already exists so a
  --    workflow retry can never re-snapshot already-zeroed values).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'cards_balance_snapshot_20260722'
  ) THEN
    CREATE TABLE public.cards_balance_snapshot_20260722 AS
      SELECT now() AS snapshotted_at, c.*
      FROM public.cards c
      WHERE c.id = ANY (zero_ids);

    -- Service-role only: snapshot holds real-user balances. RLS with no
    -- policies default-denies anon/authenticated; the REVOKE additionally
    -- pulls Supabase's default public-table grants so the table doesn't
    -- surface in the PostgREST API at all (reviewer finding M1).
    ALTER TABLE public.cards_balance_snapshot_20260722 ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.cards_balance_snapshot_20260722 FROM anon, authenticated;

    -- 2. ZERO (only inside the same first-run guard, after snapshot exists).
    -- The <> 0 filter skips the seven already-zero rows (no trigger churn).
    UPDATE public.cards
    SET points_balance = 0
    WHERE id = ANY (zero_ids)
      AND points_balance <> 0;
  END IF;

  -- 3. VALIDATE the held constraint — pre-flighted 2026-07-22: the only two
  --    rows violating [0, 50M) are in zero_ids, so this scan passes once
  --    they are zeroed. Idempotent (no-op if already validated).
  ALTER TABLE public.cards VALIDATE CONSTRAINT cards_points_balance_range;
END $$;
