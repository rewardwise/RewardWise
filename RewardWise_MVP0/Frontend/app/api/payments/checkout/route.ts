/** @format */

import { getStripeClientOrNull } from "@/lib/payments/stripe-loader";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

const TIER_AMOUNTS: Record<
	string,
	{ unitAmount: number; productName: string; path: "standard" | "premium" }
> = {
	standard: { unitAmount: 3900, productName: "Standard Concierge", path: "standard" },
	premium: { unitAmount: 19900, productName: "Premium Concierge", path: "premium" },
};

export async function POST(request: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as { travelRequestId?: string };
		const travelRequestId = body.travelRequestId;
		if (!travelRequestId) {
			return NextResponse.json(
				{ error: "travelRequestId is required" },
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

		const stripe = await getStripeClientOrNull();
		if (!stripe) {
			const { data: constraintsRow } = await supabase
				.from("travel_requests")
				.select("constraints")
				.eq("id", travelRequestId)
				.single();

			const constraints =
				(constraintsRow?.constraints as Record<string, unknown> | null) ?? {};

			await supabase
				.from("travel_requests")
				.update({
					status: "paid",
					constraints: {
						...constraints,
						stripe_payment: "bypassed",
					},
				})
				.eq("id", travelRequestId)
				.eq("user_id", user.id);

			return NextResponse.json({
				url: `${origin}/concierge/${cfg.path}?request=${encodeURIComponent(travelRequestId)}`,
			});
		}

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
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
		const message =
			e instanceof Error ? e.message : "Could not start checkout";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

