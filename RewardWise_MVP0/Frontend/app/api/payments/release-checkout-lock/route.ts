/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
	releasePendingCheckoutLock,
	type PendingLockTarget,
} from "@/utils/entitlements/pending-checkout-lock";

type Surface = "subscribe" | "day-pass" | "concierge";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildLockTarget(
	surface: Surface,
	userId: string,
	travelRequestId?: string,
): PendingLockTarget | { error: string; status: number } {
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
	if (!travelRequestId || !UUID_RE.test(travelRequestId)) {
		return {
			error: "travel_request_id required for concierge surface",
			status: 400,
		};
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
		return NextResponse.json({ error: target.error }, { status: target.status });
	}

	// IDOR guard for concierge: the lock row is keyed on travel_request_id,
	// which arrives in the request body. Without an ownership check, any
	// authenticated user could send another user's travel_request_id and
	// release a lock that's mid-checkout. Mirrors the pattern in
	// app/api/payments/checkout/route.ts:72-83. (Subscribe / day-pass are
	// safe because the keyValue is user.id, derived server-side.)
	if (surface === "concierge") {
		const travelRequestId = body.travel_request_id as string;
		const { data: row, error } = await supabase
			.from("travel_requests")
			.select("id, user_id")
			.eq("id", travelRequestId)
			.single();
		if (error || !row || row.user_id !== user.id) {
			return NextResponse.json({ error: "not_found" }, { status: 404 });
		}
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
