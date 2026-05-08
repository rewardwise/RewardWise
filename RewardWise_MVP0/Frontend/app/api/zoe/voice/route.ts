/** @format */
/**
 * /app/api/zoe/voice/route.ts
 *
 * Proxies voice turns to FastAPI:
 *   - Receives: transcript text (from browser Web Speech API)
 *   - Returns: WAV audio (NVIDIA Magpie TTS) + X-Reply / X-Prefill headers
 *
 * Branch: feature/zoe-voice-nvidia-nim
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

		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;

		// Read form from browser and inject user_id
		const formData = await req.formData();
		formData.set("user_id", user.id);

		const backendUrl =
			process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

		const backendRes = await fetch(`${backendUrl}/api/zoe/voice`, {
			method: "POST",
			headers: {
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: formData,
			signal: AbortSignal.timeout(45_000),
		});

		const exposeHeaders = "X-Reply, X-Prefill";

		if (backendRes.status === 204) {
			return new NextResponse(null, {
				status: 204,
				headers: {
					"X-Reply": backendRes.headers.get("X-Reply") || "",
					"X-Prefill": backendRes.headers.get("X-Prefill") || "",
					"Access-Control-Expose-Headers": exposeHeaders,
				},
			});
		}

		if (!backendRes.ok) {
			const err = await backendRes.text();
			console.error("Voice backend error:", err);
			return NextResponse.json(
				{ error: "Voice service unavailable" },
				{ status: backendRes.status }
			);
		}

		const audioBuffer = await backendRes.arrayBuffer();

		return new NextResponse(audioBuffer, {
			status: 200,
			headers: {
				"Content-Type": "audio/wav",
				"X-Reply": backendRes.headers.get("X-Reply") || "",
				"X-Prefill": backendRes.headers.get("X-Prefill") || "",
				"Access-Control-Expose-Headers": exposeHeaders,
			},
		});
	} catch (err) {
		console.error("Voice proxy error:", err);
		return NextResponse.json(
			{ error: "Voice service temporarily unavailable" },
			{ status: 503 }
		);
	}
}
