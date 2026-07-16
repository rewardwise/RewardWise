/** @format */

import { NextResponse } from "next/server";

// Wind-down (2026-07): MyTravelWallet is free for everyone. The paid Concierge
// tiers (Standard $19 / Premium $199) are retired — this route no longer mints
// Stripe Checkout sessions so no new one-time charge can be started. The full
// implementation is preserved in git history; revert this commit to restore
// paid Concierge checkout.
export async function POST() {
  return NextResponse.json(
    {
      error: "payments_disabled",
      message: "MyTravelWallet is now free — no payment required.",
    },
    { status: 410 },
  );
}
