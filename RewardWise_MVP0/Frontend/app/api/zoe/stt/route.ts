/** @format */
/**
 * /app/api/zoe/stt/route.ts
 *
 * Proxies audio blobs from the browser to FastAPI Parakeet STT.
 * Returns: { transcript: string }
 */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const formData = await req.formData();
		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

		const backendRes = await fetch(`${backendUrl}/api/zoe/stt`, {
			method: "POST",
			body: formData,
		});

		const data = await backendRes.json();
		return NextResponse.json(data, { status: backendRes.status });
	} catch (err) {
		console.error("STT proxy error:", err);
		return NextResponse.json({ error: "STT unavailable" }, { status: 503 });
	}
}
