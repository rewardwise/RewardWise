-- Security fix: lock down payment_notifications INSERT.
--
-- The original policy (20260430174722_payment_notifications.sql) was named
-- "Service role can insert notifications" but had NO `TO` clause — so it
-- defaulted to TO public (anon + authenticated) with WITH CHECK (TRUE). That
-- let anyone holding the public anon key (shipped in the frontend bundle)
-- INSERT arbitrary rows — any user_id / title / message — into a payments-
-- adjacent, user-facing table. PaymentNotificationBanner renders title/message
-- (payment_failed persists, no auto-dismiss), so this was a spoofing/phishing
-- vector plus an unbounded write-spam surface.
--
-- The only LEGITIMATE writer is the Stripe webhook (app/api/payments/webhook/
-- route.ts), which uses SUPABASE_SERVICE_ROLE_KEY (service_role, which bypasses
-- RLS entirely). No client-side INSERT path exists — the client only SELECTs
-- and UPDATEs is_read, both already scoped to auth.uid() = user_id.
--
-- Fix: recreate the INSERT policy scoped `TO service_role` so anon/authenticated
-- get no INSERT grant (RLS default-deny). SELECT/UPDATE policies are unchanged.
-- Additive + idempotent; safe in the merge deploy window.

DROP POLICY IF EXISTS "Service role can insert notifications" ON payment_notifications;

CREATE POLICY "Service role can insert notifications"
  ON payment_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);
