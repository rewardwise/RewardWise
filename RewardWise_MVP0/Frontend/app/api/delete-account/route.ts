/** @format */

import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { NextResponse } from "next/server";

const BEARER_RE = /^Bearer\s+(.+)$/i;

export async function DELETE(request: Request) {
	try {
		const ip = getClientIp(request);
		const { allowed, retryAfterMs } = checkRateLimit(`delete-account:${ip}`, {
			maxRequests: 3,
			windowMs: 300_000,
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

		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!,
		);

		const authHeader = request.headers.get("authorization");
		if (!authHeader) {
			return NextResponse.json(
				{ error: "Missing authorization header" },
				{ status: 401 },
			);
		}

		const match = BEARER_RE.exec(authHeader);
		if (!match) {
			return NextResponse.json(
				{ error: "Invalid authorization format" },
				{ status: 401 },
			);
		}
		const token = match[1];

		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser(token);

		if (userError || !user) {
			return NextResponse.json(
				{ error: "Invalid or expired session" },
				{ status: 401 },
			);
		}

		const { error: deleteError } = await supabase.auth.admin.deleteUser(
			user.id,
		);

		if (deleteError) {
			console.error("Delete account error:", deleteError);
			return NextResponse.json(
				{ error: "Could not delete account. Please try again." },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Account deleted successfully",
		});
	} catch (error) {
		console.error("Delete account error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
