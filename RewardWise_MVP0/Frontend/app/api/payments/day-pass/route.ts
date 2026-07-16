/** @format */

import { NextResponse } from "next/server";

// Wind-down (2026-07): MyTravelWallet is free for everyone. The one-time
// 24-hour Day Pass is retired — this route no longer mints Stripe Checkout
// sessions so no new charge can be started. The full implementation is
// preserved in git history; revert this commit to restore the Day Pass.
export async function POST() {
  return NextResponse.json(
    {
      error: "payments_disabled",
      message: "MyTravelWallet is now free — no pass required.",
    },
    { status: 410 },
  );
}
