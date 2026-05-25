-- Parallel-checkout lock for Day Pass purchases.
--
-- ROOT CAUSE addressed: the original Megan Bittner double-charge
-- (pi_3TZDPLJBOkdxC5V11Vc5FEMA + pi_3TZDQVJBOkdxC5V10xNCRKD4, 72-second
-- gap) was NOT a confirm-day-pass retry — it was two parallel Stripe
-- Checkout sessions created from two open tabs (mobile + desktop, or
-- two device sessions for the same user) before either had finished
-- paying. The processed_stripe_sessions ledger only dedups AFTER
-- fulfillment, by which point both charges have already settled.
--
-- The actual race-condition fix needs to be UPSTREAM of
-- stripe.checkout.sessions.create — prevent a second checkout session
-- from being minted while a first is still in flight.
--
-- Design:
--   * user_id is PRIMARY KEY. The day-pass route inserts a row before
--     calling Stripe; the unique violation IS the lock. No advisory
--     locks, no SELECT-FOR-UPDATE, no per-row state machine — Postgres'
--     PRIMARY KEY constraint is the synchronization primitive.
--   * expires_at gives the lock a 5-minute TTL so an abandoned tab
--     can't lock a user out forever. Stripe Checkout sessions are valid
--     for 24h by default, but a stale tab past 5 minutes is overwhelmingly
--     a "user closed it" signal — the next click should be allowed
--     through, and if both old + new Stripe sessions somehow get paid,
--     processed_stripe_sessions catches the second one as a no-op grant.
--   * Released by: (a) confirm-day-pass on successful fulfillment,
--     (b) checkout.session.expired webhook (Stripe's default expiry is
--     24h, but if the user explicitly cancels we'll get this sooner).
--   * No cleanup cron. The 5-min TTL + DELETE-on-success keeps the
--     table bounded; pathological abandoned-tab rows are reaped on
--     the user's next attempt (stale-row DELETE + retry path).
--
-- Defense-in-depth: this is the PRIMARY race fix. processed_stripe_sessions
-- (20260524181734) remains the secondary fulfillment-side dedup so any
-- race that slips through (or any future replay attack via webhook
-- replay) still cannot stack 24h windows or charge twice.

CREATE TABLE IF NOT EXISTS pending_day_pass_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE pending_day_pass_sessions ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated users.
-- Service role bypasses RLS; only day-pass + confirm-day-pass + webhook
-- handlers (using SUPABASE_SERVICE_ROLE_KEY) touch this table.
