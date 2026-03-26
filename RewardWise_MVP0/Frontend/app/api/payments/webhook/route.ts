/** @format */

import { getStripeClientOrNull } from "@/lib/payments/stripe-loader";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const rawBody = await request.text();
	const headerList = await headers();
	const sig = headerList.get("stripe-signature");

	if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
		return NextResponse.json(
			{ error: "Missing webhook configuration" },
			{ status: 400 },
		);
	}

	if (
		!process.env.NEXT_PUBLIC_SUPABASE_URL ||
		!process.env.SUPABASE_SERVICE_ROLE_KEY
	) {
		console.error(
			"payments webhook: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
		);
		return NextResponse.json({ received: true });
	}

	let event: unknown;
	try {
		const stripe = await getStripeClientOrNull();
		if (!stripe) {
			return NextResponse.json({ received: true, provider: "none" });
		}
		event = stripe.webhooks.constructEvent(
			rawBody,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET,
		);
	} catch (err) {
		console.error("Webhook signature verification failed:", err);
		return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
	}

	const parsed = event as {
		type?: string;
		data?: { object?: Record<string, unknown> };
	};

	if (parsed.type === "checkout.session.completed") {
		const session = parsed.data?.object ?? {};
		const requestId =
			((session.metadata as Record<string, string> | undefined)
				?.travel_request_id as string | undefined) ??
			(session.client_reference_id as string | undefined);
		if (!requestId) {
			console.warn("checkout.session.completed: missing travel_request_id");
			return NextResponse.json({ received: true });
		}

		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.SUPABASE_SERVICE_ROLE_KEY,
		);

		const { data: row } = await supabase
			.from("travel_requests")
			.select("constraints")
			.eq("id", requestId)
			.single();

		const constraints = (row?.constraints as Record<string, unknown> | null) ?? {};

		const { error: updateError } = await supabase
			.from("travel_requests")
			.update({
				status: "paid",
				constraints: {
					...constraints,
					stripe_payment: "paid",
					stripe_checkout_session_id: session.id as string | undefined,
				},
			})
			.eq("id", requestId);

		if (updateError) {
			console.error("Webhook DB update:", updateError);
		}
	}

	return NextResponse.json({ received: true });
}

