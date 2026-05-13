/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL =
	process.env.BACKEND_URL ??
	process.env.NEXT_PUBLIC_API_URL ??
	"http://127.0.0.1:8000";

const MAX_BODY_SIZE = 10_000;

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
			return NextResponse.json({ error: "Request body too large" }, { status: 413 });
		}

		let body: unknown;
		try {
			body = JSON.parse(rawBody);
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}

		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;

		const res = await fetch(`${BACKEND_URL}/api/zoe/feedback`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(15_000),
		});

		const data = await res.json().catch(() => ({}));
		return NextResponse.json(data, { status: res.status });
	} catch (err) {
		console.error("Zoe feedback proxy error:", err);
		return NextResponse.json(
			{ error: "Feedback temporarily unavailable" },
			{ status: 503 }
		);
	}
}