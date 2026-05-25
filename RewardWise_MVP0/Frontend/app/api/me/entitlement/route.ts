/** @format */

import { checkEntitlement } from "@/utils/entitlements/check-entitlement";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`entitlement:${ip}`, {
			maxRequests: 60,
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

		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const entitlement = await checkEntitlement(supabase, user.id);
		return NextResponse.json(entitlement, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (e) {
		console.error("me/entitlement:", e);
		return NextResponse.json(
			{ error: "Failed to load entitlement" },
			{ status: 500 },
		);
	}
}
