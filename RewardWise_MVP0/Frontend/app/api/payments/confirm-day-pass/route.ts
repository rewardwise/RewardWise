/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import {
	fulfillDayPassCheckout,
	isDayPassStripePurchaseType,
} from "@/utils/entitlements/day-pass-checkout";
import { releasePendingCheckoutLock } from "@/utils/entitlements/pending-checkout-lock";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
	CONFIRM_PASS_ACTIVATE_FAILED,
	CONFIRM_PASS_BAD_SESSION_ID,
	CONFIRM_PASS_PAYMENT_PENDING,
	CONFIRM_PASS_WRONG_ACCOUNT,
	CONFIRM_PASS_WRONG_PRODUCT,
	CONFIRM_PAYMENT_BANK_PENDING,
	CONFIRM_SERVER_TEMPORARY,
	PAY_RATE_LIMIT_SHORT,
	PAY_SIGN_IN_AGAIN,
} from "@/utils/user-messages";

export const runtime = "nodejs";

export async function POST(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`confirm-day-pass:${ip}`, {
			maxRequests: 20,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: PAY_RATE_LIMIT_SHORT },
				{
					status: 429,
					headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
				},
			);
		}

		getStripeEnv();

		const supabaseUser = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabaseUser.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: PAY_SIGN_IN_AGAIN }, { status: 401 });
		}

		const body = (await request.json()) as { sessionId?: string };
		const sessionId = body.sessionId?.trim();
		if (!sessionId || !sessionId.startsWith("cs_")) {
			return NextResponse.json(
				{ error: CONFIRM_PASS_BAD_SESSION_ID },
				{ status: 400 },
			);
		}

		const stripe = getStripe();
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.mode !== "payment" || session.payment_status !== "paid") {
			return NextResponse.json(
				{ error: CONFIRM_PASS_PAYMENT_PENDING },
				{ status: 400 },
			);
		}

		const meta = (session.metadata ?? {}) as Record<string, string | undefined>;
		if (!isDayPassStripePurchaseType(meta.purchase_type)) {
			return NextResponse.json(
				{ error: CONFIRM_PASS_WRONG_PRODUCT },
				{ status: 400 },
			);
		}

		if (!meta.user_id || meta.user_id !== user.id) {
			return NextResponse.json(
				{ error: CONFIRM_PASS_WRONG_ACCOUNT },
				{ status: 403 },
			);
		}

		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !serviceKey) {
			return NextResponse.json({ error: CONFIRM_SERVER_TEMPORARY }, { status: 500 });
		}

		const admin = createClient(url, serviceKey);
		const amountTotal = Number(session.amount_total ?? 0);

		const result = await fulfillDayPassCheckout(admin, {
			userId: user.id,
			amountTotalCents: amountTotal,
			stripeSessionId: sessionId,
		});

		if (!result.ok) {
			// 400 for inputs that don't match a fulfillable Stripe session
			// (caller-correctable: bad sessionId format, wrong amount on the
			// session). 500 for server-side persistence problems where the
			// receipt is valid but our DB couldn't record the grant or the
			// dedup row — caller has nothing to fix, the right user action
			// is "try again in a minute" not "this payment is invalid."
			const isServerSide =
				result.error === "ledger_insert_failed" ||
				result.error === "grant_failed";
			return NextResponse.json(
				{ error: CONFIRM_PASS_ACTIVATE_FAILED },
				{ status: isServerSide ? 500 : 400 },
			);
		}

		// Release the parallel-checkout lock now that this session is
		// fulfilled. Failure to release is non-fatal — the 5-minute TTL
		// will reap the row, and a stale row gets DELETEd + retried on
		// the user's next checkout attempt.
		await releasePendingCheckoutLock(admin, {
			table: "pending_day_pass_sessions",
			keyColumn: "user_id",
			keyValue: user.id,
		});

		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error("confirm-day-pass:", e);
		return NextResponse.json(
			{ error: CONFIRM_PAYMENT_BANK_PENDING },
			{ status: 500 },
		);
	}
}
