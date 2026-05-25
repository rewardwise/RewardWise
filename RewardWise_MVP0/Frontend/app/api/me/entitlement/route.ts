/** @format */

import { checkEntitlement } from "@/utils/entitlements/check-entitlement";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";
import {
	ENTITLEMENT_LOAD_FAIL,
	PAY_RATE_LIMIT_SHORT,
	PAY_SIGN_IN_AGAIN,
} from "@/utils/user-messages";

export async function GET(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`entitlement:${ip}`, {
			maxRequests: 60,
			windowMs: 60_000,
		});
		if (!allowed) {
			return NextResponse.json(
				{ error: PAY_RATE_LIMIT_SHORT },
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
			return NextResponse.json({ error: PAY_SIGN_IN_AGAIN }, { status: 401 });
		}

		const entitlement = await checkEntitlement(supabase, user.id);
		return NextResponse.json(entitlement, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (e) {
		console.error("me/entitlement:", e);
		return NextResponse.json(
			{ error: ENTITLEMENT_LOAD_FAIL },
			{ status: 500 },
		);
	}
}
