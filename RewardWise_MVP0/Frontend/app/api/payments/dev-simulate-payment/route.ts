/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

/**
 * When MOCK_STRIPE_PAYMENT=true, marks the request paid without provider checkout.
 * Never set MOCK_STRIPE_PAYMENT in production.
 */
export async function POST(request: Request) {
	if (process.env.MOCK_STRIPE_PAYMENT !== "true") {
		return NextResponse.json({ error: "Mock payment not enabled" }, { status: 403 });
	}

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
				{ error: "travelRequestId required" },
				{ status: 400 },
			);
		}

		const { data: row, error: fetchErr } = await supabase
			.from("travel_requests")
			.select("id, user_id, constraints")
			.eq("id", travelRequestId)
			.single();

		if (fetchErr || !row || row.user_id !== user.id) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		const constraints = (row.constraints as Record<string, unknown>) ?? {};

		const { error: updateErr } = await supabase
			.from("travel_requests")
			.update({
				status: "paid",
				constraints: {
					...constraints,
					stripe_payment: "paid",
					stripe_checkout_mock: true,
				},
			})
			.eq("id", travelRequestId);

		if (updateErr) {
			console.error("dev-simulate-payment:", updateErr);
			return NextResponse.json(
				{ error: updateErr.message },
				{ status: 500 },
			);
		}

		return NextResponse.json({ ok: true, mock: true });
	} catch (e) {
		console.error("dev-simulate-payment:", e);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}

