/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
	releasePendingCheckoutLock,
	type PendingLockTarget,
} from "@/utils/entitlements/pending-checkout-lock";

type Surface = "subscribe" | "day-pass" | "concierge";

function buildLockTarget(
	surface: Surface,
	userId: string,
	travelRequestId?: string,
): PendingLockTarget | { error: string } {
	if (surface === "subscribe") {
		return {
			table: "pending_subscribe_sessions",
			keyColumn: "user_id",
			keyValue: userId,
		};
	}
	if (surface === "day-pass") {
		return {
			table: "pending_day_pass_sessions",
			keyColumn: "user_id",
			keyValue: userId,
		};
	}
	if (!travelRequestId) {
		return { error: "travel_request_id required for concierge surface" };
	}
	return {
		table: "pending_concierge_sessions",
		keyColumn: "travel_request_id",
		keyValue: travelRequestId,
	};
}

export async function POST(request: Request) {
	const supabase = await createRouteHandlerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
	}

	let body: { surface?: string; travel_request_id?: string };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return NextResponse.json({ error: "invalid_body" }, { status: 400 });
	}

	const surface = body.surface;
	if (surface !== "subscribe" && surface !== "day-pass" && surface !== "concierge") {
		return NextResponse.json({ error: "invalid_surface" }, { status: 400 });
	}

	const target = buildLockTarget(surface, user.id, body.travel_request_id);
	if ("error" in target) {
		return NextResponse.json({ error: target.error }, { status: 400 });
	}

	// Lock tables have RLS with zero policies — only the service role can
	// delete rows. The route-handler client (anon + user JWT) would no-op
	// silently. Mirrors the pattern in subscribe/day-pass/checkout routes.
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceKey) {
		return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
	}
	const admin = createClient(supabaseUrl, serviceKey);

	await releasePendingCheckoutLock(admin, target);
	return NextResponse.json({ ok: true });
}
