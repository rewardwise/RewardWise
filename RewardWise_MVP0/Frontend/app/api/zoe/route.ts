/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		const body = await req.json();

		// Always inject the authenticated user_id so the backend can:
		//   1. Log interactions with the correct user
		//   2. Fetch wallet from DB if frontend didn't send it
		const enrichedBody = {
			...body,
			user_id: user?.id ?? null,
		};

		const res = await fetch(`${BACKEND_URL}/api/zoe`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(enrichedBody),
		});

		const data = await res.json();

		// Persist messages to zoe_messages table (best-effort)
		if (user && body.conversation_id && body.message) {
			try {
				const conversation_id = body.conversation_id;

				// Save the user's message
				await supabase.from("zoe_messages").insert({
					conversation_id,
					role: "user",
					content: body.message,
				});

				// Save Zoe's reply
				if (data.message) {
					await supabase.from("zoe_messages").insert({
						conversation_id,
						role: "assistant",
						content: data.message,
					});
				}

				// Update conversation title on first message
				const isFirstMessage =
					(body.history ?? []).filter(
						(m: { role: string }) => m.role === "user"
					).length === 0;

				if (isFirstMessage && body.message) {
					const title =
						body.message.length > 60
							? body.message.slice(0, 57) + "…"
							: body.message;
					await supabase
						.from("zoe_conversations")
						.update({ title })
						.eq("id", conversation_id);
				}
			} catch (dbErr) {
				console.error("Zoe DB persist error:", dbErr);
				// Non-fatal
			}
		}

		return NextResponse.json(data, { status: res.status });
	} catch (err) {
		console.error("Zoe API error:", err);
		return NextResponse.json(
			{ message: "Service temporarily unavailable" },
			{ status: 503 }
		);
	}
}

// GET — load messages for a conversation
export async function GET(req: Request) {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user)
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const { searchParams } = new URL(req.url);
		const conversationId = searchParams.get("conversation_id");
		if (!conversationId)
			return NextResponse.json(
				{ error: "Missing conversation_id" },
				{ status: 400 }
			);

		const { data: conv } = await supabase
			.from("zoe_conversations")
			.select("id")
			.eq("id", conversationId)
			.eq("user_id", user.id)
			.single();

		if (!conv)
			return NextResponse.json({ error: "Not found" }, { status: 404 });

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