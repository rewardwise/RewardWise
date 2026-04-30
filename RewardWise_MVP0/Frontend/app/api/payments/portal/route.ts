/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`portal:${ip}`, {
			maxRequests: 5,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: "Too many requests." },
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
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: sub } = await supabase
			.from("subscriptions")
			.select("stripe_customer_id")
			.eq("user_id", user.id)
			.single();

		if (!sub?.stripe_customer_id) {
			return NextResponse.json(
				{ error: "No active subscription found." },
				{ status: 404 },
			);
		}

		const origin =
			request.headers.get("origin") ?? new URL(request.url).origin;

		const stripe = getStripe();

		const portalSession = await stripe.billingPortal.sessions.create({
			customer: sub.stripe_customer_id,
			return_url: `${origin}/profile`,
		});

		return NextResponse.json({ url: portalSession.url });
	} catch (e) {
		console.error("billing portal:", e);
		return NextResponse.json(
			{ error: "Could not open billing portal. Please try again." },
			{ status: 500 },
		);
	}
}
