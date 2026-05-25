-- Parallel-checkout lock for Concierge purchases.
--
-- Same architectural pattern as pending_day_pass_sessions (20260524201358)
-- and pending_subscribe_sessions (20260524202718), applied to the
-- concierge surface. The Megan Bittner audit revealed that
-- /api/payments/checkout had no payment_status guard — a user with an
-- already-paid concierge request could POST again from a second tab and
-- mint a duplicate $19 / $199 Stripe Checkout for the same travel_request.
-- The blast radius is per-request (one duplicate per impacted request,
-- not recurring), but at $199/Premium the per-incident cost is the
-- worst of the three surfaces.
--
-- Key difference vs. the other two: this table is keyed on
-- travel_request_id, not user_id. The right uniqueness boundary for
-- concierge is the request — a single user can legitimately have
-- multiple concierge requests in flight simultaneously, so locking on
-- user_id would block a fresh request while an unrelated one is being
-- paid for. travel_request_id is also already a UUID PRIMARY KEY in
-- travel_requests, so the FK enforces referential integrity for free.
--
-- Released by: (a) Stripe webhook checkout.session.completed for
-- mode=payment with travel_request_id metadata (or client_reference_id),
-- (b) checkout.session.expired with the same metadata, (c) the
-- checkout route itself on Stripe API failure.

CREATE TABLE IF NOT EXISTS pending_concierge_sessions (
  travel_request_id UUID PRIMARY KEY REFERENCES travel_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE pending_concierge_sessions ENABLE ROW LEVEL SECURITY;
