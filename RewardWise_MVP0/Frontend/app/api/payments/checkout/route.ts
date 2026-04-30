/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIER_AMOUNTS: Record<
	string,
	{ unitAmount: number; productName: string; path: "standard" | "premium" }
> = {
	standard: { unitAmount: 3900, productName: "Standard Concierge", path: "standard" },
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

		const body = (await request.json()) as { travelRequestId?: string };
		const travelRequestId = body.travelRequestId;
		if (!travelRequestId || !UUID_RE.test(travelRequestId)) {
			return NextResponse.json(
				{ error: "Valid travelRequestId is required" },
				{ status: 400 },
			);
		}

		const { data: row, error } = await supabase
			.from("travel_requests")
			.select("id, user_id, tier")
			.eq("id", travelRequestId)
			.single();

		if (error || !row || row.user_id !== user.id) {
			return NextResponse.json({ error: "Request not found" }, { status: 404 });
		}

		const cfg = TIER_AMOUNTS[row.tier as string];
		if (!cfg) {
			return NextResponse.json({ error: "Unsupported tier" }, { status: 400 });
		}

		const origin =
			request.headers.get("origin") ?? new URL(request.url).origin;

		const stripe = getStripe();

		const session = await stripe.checkout.sessions.create({
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

		if (!session.url) {
			return NextResponse.json(
				{ error: "No checkout URL returned" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ url: session.url });
	} catch (e) {
		console.error("payments checkout:", e);
		return NextResponse.json(
			{ error: "Could not start checkout. Please try again." },
			{ status: 500 },
		);
	}
}
