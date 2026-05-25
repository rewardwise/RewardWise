/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
	acquirePendingCheckoutLock,
	releasePendingCheckoutLock,
} from "@/utils/entitlements/pending-checkout-lock";
import {
	CHECKOUT_ALREADY_PAID,
	CHECKOUT_GENERIC_FAIL,
	CHECKOUT_NO_URL,
	CHECKOUT_RATE_LIMIT,
	CHECKOUT_SIGN_IN,
	CHECKOUT_TIER_UNAVAILABLE,
	CHECKOUT_TRAVEL_ID_INVALID,
	CHECKOUT_TRAVEL_NOT_FOUND,
	CONFIRM_SERVER_TEMPORARY,
	PAY_CHECKOUT_IN_FLIGHT,
} from "@/utils/user-messages";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIER_AMOUNTS: Record<
	string,
	{ unitAmount: number; productName: string; path: "standard" | "premium" }
> = {
	standard: { unitAmount: 1900, productName: "Standard Concierge", path: "standard" },
	premium: { unitAmount: 19900, productName: "Premium Concierge", path: "premium" },
};

export async function POST(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`checkout:${ip}`, {
			maxRequests: 5,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: CHECKOUT_RATE_LIMIT },
				{
					status: 429,
					headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
				},
			);
		}

		getStripeEnv();

		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: CHECKOUT_SIGN_IN }, { status: 401 });
		}

		const body = (await request.json()) as { travelRequestId?: string };
		const travelRequestId = body.travelRequestId;
		if (!travelRequestId || !UUID_RE.test(travelRequestId)) {
			return NextResponse.json(
				{ error: CHECKOUT_TRAVEL_ID_INVALID },
				{ status: 400 },
			);
		}

		const { data: row, error } = await supabase
			.from("travel_requests")
			.select("id, user_id, tier, status")
			.eq("id", travelRequestId)
			.single();

		if (error || !row || row.user_id !== user.id) {
			return NextResponse.json(
				{ error: CHECKOUT_TRAVEL_NOT_FOUND },
				{ status: 404 },
			);
		}

		// Server-side payment_status guard. Without this, a user with a
		// paid Premium concierge request can POST again from a second tab
		// and Stripe will mint a duplicate $199 Checkout for the same
		// travel_request. travel_requests.status='paid' is the
		// per-surface fulfillment ledger for concierge — it's set by the
		// webhook on checkout.session.completed and is the single source
		// of truth for "has this request been paid for."
		if (row.status === "paid") {
			return NextResponse.json(
				{
					error: "already_paid",
					message: CHECKOUT_ALREADY_PAID,
					travel_request_id: travelRequestId,
					detail_url: `/concierge/${TIER_AMOUNTS[row.tier as string]?.path ?? "standard"}?travel_request_id=${encodeURIComponent(travelRequestId)}`,
				},
				{ status: 409 },
			);
		}

		const cfg = TIER_AMOUNTS[row.tier as string];
		if (!cfg) {
			return NextResponse.json(
				{ error: CHECKOUT_TIER_UNAVAILABLE },
				{ status: 400 },
			);
		}

		// pending_concierge_sessions has RLS enabled with zero policies;
		// only the service role can read/write it. The route-handler
		// client (anon + user JWT) would silently match zero rows on
		// INSERT and we'd think the lock was free when it wasn't.
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceKey) {
			return NextResponse.json(
				{ error: CONFIRM_SERVER_TEMPORARY },
				{ status: 500 },
			);
		}
		const admin = createClient(supabaseUrl, serviceKey);

		// Lock keyed on travel_request_id, not user_id: a single user can
		// legitimately have multiple concierge requests in flight, so
		// locking on user_id would block unrelated requests.
		const lockTarget = {
			table: "pending_concierge_sessions" as const,
			keyColumn: "travel_request_id" as const,
			keyValue: travelRequestId,
		};
		const lock = await acquirePendingCheckoutLock(admin, lockTarget);
		if (!lock.ok) {
			if (lock.reason === "in_flight") {
				return NextResponse.json(
					{
						error: PAY_CHECKOUT_IN_FLIGHT,
						retryAfterSeconds: lock.retryAfterSeconds,
					},
					{
						status: 409,
						headers: { "Retry-After": String(lock.retryAfterSeconds) },
					},
				);
			}
			return NextResponse.json(
				{ error: CHECKOUT_GENERIC_FAIL },
				{ status: 500 },
			);
		}

		const origin =
			request.headers.get("origin") ?? new URL(request.url).origin;

		const stripe = getStripe();

		let session;
		try {
			session = await stripe.checkout.sessions.create({
				mode: "payment",
				payment_method_types: ["card"],
				line_items: [
					{
						price_data: {
							currency: "usd",
							unit_amount: cfg.unitAmount,
							product_data: { name: cfg.productName },
						},
						quantity: 1,
					},
				],
				success_url: `${origin}/concierge/${cfg.path}?stripe_session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${origin}/concierge/${cfg.path}?stripe_canceled=1&travel_request_id=${encodeURIComponent(travelRequestId)}`,
				client_reference_id: travelRequestId,
				metadata: {
					travel_request_id: travelRequestId,
					user_id: user.id,
					tier: row.tier as string,
				},
			});
		} catch (stripeErr) {
			// Stripe failure means no checkout session was minted, so
			// release the lock to avoid a 5-minute lockout on the same
			// travel_request after a transient Stripe outage.
			await releasePendingCheckoutLock(admin, lockTarget);
			throw stripeErr;
		}

		if (!session.url) {
			await releasePendingCheckoutLock(admin, lockTarget);
			return NextResponse.json(
				{ error: CHECKOUT_NO_URL },
				{ status: 500 },
			);
		}

		return NextResponse.json({ url: session.url });
	} catch (e) {
		console.error("payments checkout:", e);
		return NextResponse.json(
			{ error: CHECKOUT_GENERIC_FAIL },
			{ status: 500 },
		);
	}
}
