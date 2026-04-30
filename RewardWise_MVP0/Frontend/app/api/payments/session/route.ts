/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`session:${ip}`, {
			maxRequests: 20,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: "Too many requests" },
				{
					status: 429,
					headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
				},
			);
		}

		getStripeEnv();

		const { searchParams } = new URL(request.url);
		const sessionId = searchParams.get("session_id");
		if (!sessionId || !/^cs_/.test(sessionId)) {
			return NextResponse.json(
				{ error: "Valid session_id is required" },
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

		const stripe = getStripe();
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
		return NextResponse.json(
			{ error: "Could not verify payment session. Please try again." },
			{ status: 500 },
		);
	}
}
