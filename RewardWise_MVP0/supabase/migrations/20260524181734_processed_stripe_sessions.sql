-- Idempotency ledger for Stripe Checkout session fulfillment.
--
-- ROOT CAUSE addressed: confirm-day-pass repeatedly fulfills the same
-- session_id when the user retries (double-tab, mobile flake, refresh on
-- success page). Pre-fix code in profile-passes-server.ts deliberately
-- stacked 24h windows onto existing expiries, so each retry charged the
-- user $0.99 AND extended their pass — silently. Evidence: PR description
-- (ClickUp 86b9yj5ut), Megan Bittner $0.99 x2, gap 72s.
--
-- Design:
--   * session_id is Stripe's checkout session identifier (cs_*). Unique
--     per checkout attempt, never reused. Perfect dedup key.
--   * INSERT race-safe via PRIMARY KEY; concurrent retries hit unique
--     violation, and the fulfillment helper treats that as "already
--     processed, do nothing".
--   * No RLS — service-role-only writes; users never read this directly.

CREATE TABLE IF NOT EXISTS processed_stripe_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_type TEXT NOT NULL,
  amount_cents INTEGER,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_sessions_user
  ON processed_stripe_sessions(user_id, granted_at DESC);

ALTER TABLE processed_stripe_sessions ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE policies for authenticated users.
-- Service role bypasses RLS, so confirm-day-pass + webhook handlers
-- (which use SUPABASE_SERVICE_ROLE_KEY) can read + write freely.
