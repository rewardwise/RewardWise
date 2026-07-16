/** @format */

import { NextResponse } from "next/server";

// Wind-down (2026-07): MyTravelWallet is free for everyone. The monthly Pro
// subscription is retired — this route no longer mints Stripe Checkout
// sessions so no new recurring charge can be started. Existing subscriptions
// are set to cancel at period end via Stripe directly (no code path).
// The full implementation is preserved in git history; revert this commit to
// restore paid subscriptions.
export async function POST() {
  return NextResponse.json(
    {
      error: "payments_disabled",
      message: "MyTravelWallet is now free — no subscription required.",
    },
    { status: 410 },
  );
}
