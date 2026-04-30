/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`subscribe:${ip}`, {
			maxRequests: 5,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: "Too many requests. Please wait before trying again." },
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

		const origin =
			request.headers.get("origin") ?? new URL(request.url).origin;

		const stripe = getStripe();

		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			payment_method_types: ["card"],
			line_items: [
				{
					price_data: {
						currency: "usd",
						unit_amount: 999,
						recurring: { interval: "month" },
						product_data: { name: "MyTravelWallet Pro - Monthly" },
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

		if (!session.url) {
			return NextResponse.json(
				{ error: "No checkout URL returned" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ url: session.url });
	} catch (e) {
		console.error("subscribe checkout:", e);
		return NextResponse.json(
			{ error: "Could not start subscription checkout. Please try again." },
			{ status: 500 },
		);
	}
}
