/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

const MAX_BODY_SIZE = 50_000;

export async function POST(req: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const rawBody = await req.text();
		if (rawBody.length > MAX_BODY_SIZE) {
			return NextResponse.json({ error: "Request body too large" }, { status: 413 });
		}

		let body: any;
		try {
			body = JSON.parse(rawBody);
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}

		const { conversation_id, message, history } = body;

		// Forward to backend with user_id injected
		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
		const session = await supabase.auth.getSession();
		const accessToken = session.data.session?.access_token;

		const res = await fetch(`${backendUrl}/api/zoe`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify({ ...body, user_id: user.id }),
			signal: AbortSignal.timeout(45_000),
		});

		const data = await res.json();

		// Persist conversation to Supabase if we have a conversation_id
		if (conversation_id && message && data.message) {
			try {
				// Save user message
				await supabase.from("zoe_messages").insert({
					conversation_id,
					role: "user",
					content: message,
				});

				// Save assistant reply
				await supabase.from("zoe_messages").insert({
					conversation_id,
					role: "assistant",
					content: data.message,
				});

				// Auto-title the conversation from the first user message (if title is still default)
				const { data: conv } = await supabase
					.from("zoe_conversations")
					.select("title")
					.eq("id", conversation_id)
					.single();

				if (conv?.title === "New conversation") {
					const title = message.length > 60 ? message.slice(0, 57) + "…" : message;
					await supabase
						.from("zoe_conversations")
						.update({ title })
						.eq("id", conversation_id);
				}
			} catch (dbErr) {
				console.error("Zoe DB persist error:", dbErr);
				// Don't fail the response — DB persistence is best-effort
			}
		}

		return NextResponse.json(data, { status: res.status });
	} catch (err) {
		console.error("Zoe API error:", err);
		return NextResponse.json({ message: "Service temporarily unavailable" }, { status: 503 });
	}
}

// GET — load messages for a conversation
export async function GET(req: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const { searchParams } = new URL(req.url);
		const conversationId = searchParams.get("conversation_id");
		if (!conversationId) return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });

		// Verify ownership
		const { data: conv } = await supabase
			.from("zoe_conversations")
			.select("id")
			.eq("id", conversationId)
			.eq("user_id", user.id)
			.single();

		if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

		const { data: messages } = await supabase
			.from("zoe_messages")
			.select("role, content, created_at")
			.eq("conversation_id", conversationId)
			.order("created_at", { ascending: true });

		return NextResponse.json({ messages: messages || [] });
	} catch (err) {
		console.error("Zoe GET error:", err);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
