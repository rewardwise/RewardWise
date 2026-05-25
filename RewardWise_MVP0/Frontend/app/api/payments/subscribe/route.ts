/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkEntitlement } from "@/utils/entitlements/check-entitlement";
import {
	acquirePendingCheckoutLock,
	releasePendingCheckoutLock,
} from "@/utils/entitlements/pending-checkout-lock";
import {
	CONFIRM_SERVER_TEMPORARY,
	PAY_CHECKOUT_IN_FLIGHT,
	SUBSCRIBE_ALREADY_ACTIVE,
	SUBSCRIBE_GENERIC_FAIL,
	SUBSCRIBE_NO_CHECKOUT_URL,
	SUBSCRIBE_RATE_LIMIT,
	SUBSCRIBE_SIGN_IN,
} from "@/utils/user-messages";

export async function POST(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`subscribe:${ip}`, {
			maxRequests: 5,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: SUBSCRIBE_RATE_LIMIT },
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
			return NextResponse.json({ error: SUBSCRIBE_SIGN_IN }, { status: 401 });
		}

		// Server-side entitlement guard. Without this, a user with an
		// active monthly subscription can POST again from a second tab
		// and Stripe will mint a duplicate subscription that bills them
		// every month until manual reconciliation. Strictly worse than
		// the $0.99 Day Pass case — recurring exposure.
		//
		// Note: an active Day Pass does NOT block a subscribe attempt.
		// A user on Day Pass clicking Subscribe is intentionally
		// upgrading from one-shot to recurring; the Day Pass continues
		// to count until its expiry alongside the new subscription.
		const entitlement = await checkEntitlement(supabase, user.id);
		if (entitlement.hasActiveSubscription) {
			return NextResponse.json(
				{
					error: "already_subscribed",
					message: SUBSCRIBE_ALREADY_ACTIVE,
					current_tier: "monthly",
					hasActiveSubscription: true,
					subStatus: entitlement.subStatus,
					currentPeriodEnd: entitlement.currentPeriodEnd,
					hasActiveDayPass: entitlement.hasActiveDayPass,
					upsell: null,
				},
				{ status: 409 },
			);
		}

		// pending_subscribe_sessions has RLS enabled with zero policies;
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

		const lockTarget = {
			table: "pending_subscribe_sessions" as const,
			keyColumn: "user_id" as const,
			keyValue: user.id,
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
				{ error: SUBSCRIBE_GENERIC_FAIL },
				{ status: 500 },
			);
		}

		const origin =
			request.headers.get("origin") ?? new URL(request.url).origin;

		const stripe = getStripe();

		const pmTesterEmails = (process.env.PM_TESTER_EMAILS ?? "")
			.split(",")
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean);

		const userEmail = user.email?.toLowerCase() ?? "";
		const isPmTester = pmTesterEmails.includes(userEmail);

		const monthlyAmount = isPmTester ? 100 : 399;
		const productName = isPmTester
			? "MyTravelWallet Pro - PM Test Monthly"
			: "MyTravelWallet Pro - Monthly";

		let session;
		try {
			session = await stripe.checkout.sessions.create({
				mode: "subscription",
				payment_method_types: ["card"],
				line_items: [
					{
						price_data: {
							currency: "usd",
							unit_amount: monthlyAmount,
							recurring: { interval: "month" },
							product_data: { name: productName },
						},
						quantity: 1,
					},
				],
				success_url: `${origin}/subscribe?success=1`,
				cancel_url: `${origin}/subscribe?canceled=1`,
				client_reference_id: user.id,
				customer_email: user.email,
				metadata: {
					user_id: user.id,
				},
			});
		} catch (stripeErr) {
			// Stripe failure means no checkout session was minted, so
			// release the lock to avoid a 5-minute user lockout on a
			// transient Stripe outage.
			await releasePendingCheckoutLock(admin, lockTarget);
			throw stripeErr;
		}

		if (!session.url) {
			await releasePendingCheckoutLock(admin, lockTarget);
			return NextResponse.json(
				{ error: SUBSCRIBE_NO_CHECKOUT_URL },
				{ status: 500 },
			);
		}

		return NextResponse.json({ url: session.url });
	} catch (e) {
		console.error("subscribe checkout:", e);
		return NextResponse.json({ error: SUBSCRIBE_GENERIC_FAIL }, { status: 500 });
	}
}
