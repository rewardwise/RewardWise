-- Parallel-checkout lock for Monthly subscription purchases.
--
-- Same architectural pattern as pending_day_pass_sessions (see
-- 20260524201358), applied to the subscribe surface. The Megan
-- Bittner audit revealed that /api/payments/subscribe had no
-- entitlement guard at all — a user with an active monthly
-- subscription could POST again from a second tab and Stripe would
-- mint a duplicate subscription, billing them twice every month
-- until somebody noticed. This is a worse failure mode than the
-- $0.99 Day Pass case because the duplicate keeps charging on cycle.
--
-- Design mirrors pending_day_pass_sessions:
--   * user_id is PRIMARY KEY → uniqueness is the lock.
--   * 5-minute TTL → abandoned tab can't lock the user out forever.
--   * Service-role-only (RLS enabled, zero policies).
--   * Released by: (a) Stripe webhook checkout.session.completed for
--     mode=subscription, (b) checkout.session.expired, (c) the
--     subscribe route itself on Stripe API failure.

CREATE TABLE IF NOT EXISTS pending_subscribe_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE pending_subscribe_sessions ENABLE ROW LEVEL SECURITY;
