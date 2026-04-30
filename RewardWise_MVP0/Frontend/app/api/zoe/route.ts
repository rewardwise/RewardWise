/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

const MAX_BODY_SIZE = 50_000;

export async function POST(req: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const rawBody = await req.text();
		if (rawBody.length > MAX_BODY_SIZE) {
			return NextResponse.json(
				{ error: "Request body too large" },
				{ status: 413 },
			);
		}

		let body: unknown;
		try {
			body = JSON.parse(rawBody);
		} catch {
			return NextResponse.json(
				{ error: "Invalid JSON" },
				{ status: 400 },
			);
		}

		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;

		const res = await fetch(`${backendUrl}/api/zoe`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(30_000),
		});

		const data = await res.json();
		return NextResponse.json(data, { status: res.status });
	} catch (err) {
		console.error("Zoe API error:", err);
		return NextResponse.json(
			{ message: "Service temporarily unavailable" },
			{ status: 503 },
		);
	}
}
