/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";
import { USD_CENTS } from "@/utils/stripe/amounts";
import { STRIPE_DAY_PASS_PURCHASE_TYPE } from "@/utils/entitlements/day-pass-checkout";
import {
	PAY_NO_CHECKOUT_URL,
	PAY_RATE_LIMIT_SHORT,
	PAY_SEARCH_NOT_FOUND,
	PAY_SIGN_IN_AGAIN,
	PAY_START_CHECKOUT,
} from "@/utils/user-messages";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`day-pass:${ip}`, {
			maxRequests: 8,
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

		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: PAY_SIGN_IN_AGAIN }, { status: 401 });
		}

		const body = (await request.json()) as { searchId?: string | null };
		const searchId =
			body.searchId && UUID_RE.test(body.searchId) ? body.searchId : null;

		if (searchId) {
			const { data: row, error } = await supabase
				.from("searches")
				.select("id, user_id")
				.eq("id", searchId)
				.single();

			if (error || !row || row.user_id !== user.id) {
				return NextResponse.json({ error: PAY_SEARCH_NOT_FOUND }, { status: 404 });
			}
		}

		const origin =
			request.headers.get("origin") ?? new URL(request.url).origin;

		getStripeEnv();

		const stripe = getStripe();

		const metadata: Record<string, string> = {
			user_id: user.id,
			purchase_type: STRIPE_DAY_PASS_PURCHASE_TYPE,
		};
		const paymentIntentMetadata: Record<string, string> = {
			user_id: user.id,
			purchase_type: STRIPE_DAY_PASS_PURCHASE_TYPE,
		};
		if (searchId) {
			metadata.search_id = searchId;
			paymentIntentMetadata.search_id = searchId;
		}

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			payment_method_types: ["card"],
			line_items: [
				{
					price_data: {
						currency: "usd",
						unit_amount: USD_CENTS.DAY_PASS_USD_CENTS,
						product_data: {
							name: "MyTravelWallet 24-hour pass",
							description: searchId
								? "24-hour access to Verdict Search + Zoe (starts immediately)"
								: "24-hour access to Verdict Search + Zoe",
						},
					},
					quantity: 1,
				},
			],
			success_url: searchId
				? `${origin}/home?checkout=success&for_search=${encodeURIComponent(searchId)}&session_id={CHECKOUT_SESSION_ID}`
				: `${origin}/home?checkout=pass_success&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: searchId
				? `${origin}/subscribe?canceled=1&search_id=${encodeURIComponent(searchId)}`
				: `${origin}/subscribe?canceled=1`,
			client_reference_id: searchId ?? user.id,
			customer_email: user.email ?? undefined,
			metadata,
			payment_intent_data: {
				metadata: paymentIntentMetadata,
			},
		});

		if (!session.url) {
			return NextResponse.json({ error: PAY_NO_CHECKOUT_URL }, { status: 500 });
		}

		return NextResponse.json({ url: session.url });
	} catch (e) {
		console.error("day-pass checkout:", e);
		return NextResponse.json({ error: PAY_START_CHECKOUT }, { status: 500 });
	}
}
