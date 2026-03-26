/** @format */

import { getStripeClientOrNull } from "@/lib/payments/stripe-loader";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const sessionId = searchParams.get("session_id");
		if (!sessionId) {
			return NextResponse.json(
				{ error: "session_id query parameter is required" },
				{ status: 400 },
			);
		}

		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const stripe = await getStripeClientOrNull();
		if (!stripe) {
			return NextResponse.json(
				{
					error:
						"Session verification unavailable. Payment provider adapter is missing or disabled.",
				},
				{ status: 503 },
			);
		}
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.metadata?.user_id !== user.id) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		return NextResponse.json({
			payment_status: session.payment_status,
			travel_request_id:
				session.metadata?.travel_request_id ?? session.client_reference_id,
			amount_total: session.amount_total,
		});
	} catch (e) {
		console.error("payments session:", e);
		const message =
			e instanceof Error ? e.message : "Could not load checkout session";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

