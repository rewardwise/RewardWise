CREATE TABLE IF NOT EXISTS payment_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_notifications_user ON payment_notifications(user_id, is_read);

ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON payment_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON payment_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON payment_notifications
  FOR INSERT
  WITH CHECK (TRUE);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
