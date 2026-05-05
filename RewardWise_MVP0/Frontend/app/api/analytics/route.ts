/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type IncomingAnalyticsEvent = Record<string, unknown>;

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
	"user_id",
	"user_email",
	"user_role",
	"is_authenticated",
	"session_id",
	"anonymous_id",
	"visit_id",
	"event_name",
	"event_type",
	"event_source",
	"event_version",
	"page_path",
	"page_url",
	"page_title",
	"referrer",
	"previous_page_path",
	"next_page_path",
	"duration_ms",
	"latency_ms",
	"time_since_session_start_ms",
	"time_since_page_load_ms",
	"element_name",
	"element_type",
	"element_text",
	"element_id",
	"element_class",
	"element_role",
	"element_href",
	"element_label",
	"element_aria_label",
	"element_position_x",
	"element_position_y",
	"click_x",
	"click_y",
	"scroll_x",
	"scroll_y",
	"scroll_depth_percent",
	"max_scroll_depth_percent",
	"viewport_width",
	"viewport_height",
	"device_type",
	"browser",
	"browser_version",
	"os",
	"os_version",
	"user_agent",
	"screen_width",
	"screen_height",
	"pixel_ratio",
	"timezone",
	"language",
	"network_effective_type",
	"network_downlink",
	"search_id",
	"search_origin",
	"search_destination",
	"search_depart_date",
	"search_return_date",
	"search_trip_type",
	"search_cabin",
	"search_travelers",
	"search_trigger_source",
	"search_provider",
	"search_success",
	"search_error_message",
	"verdict_id",
	"verdict_recommendation",
	"verdict_confidence",
	"cash_price",
	"award_points",
	"award_fees",
	"cents_per_point",
	"historical_price_label",
	"route_match_level",
	"zoe_message_id",
	"zoe_conversation_id",
	"zoe_user_message",
	"zoe_assistant_response",
	"zoe_detected_origin",
	"zoe_detected_destination",
	"zoe_detected_depart_date",
	"zoe_detected_return_date",
	"zoe_detected_cabin",
	"zoe_detected_trip_type",
	"zoe_missing_fields",
	"zoe_model_used",
	"zoe_success",
	"zoe_error_message",
	"feedback_id",
	"feedback_rating",
	"feedback_text",
	"feedback_context",
	"error_name",
	"error_message",
	"error_stack",
	"api_endpoint",
	"api_status_code",
	"api_method",
	"metadata",
]);

function truncateString(value: unknown, max = 8000) {
	if (typeof value !== "string") return value;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
	if (depth > 5) return "[truncated]";
	if (value === null || value === undefined) return value;
	if (["string", "number", "boolean"].includes(typeof value)) return truncateString(value, 8000);
	if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeMetadata(item, depth + 1));
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([key]) => !/(password|token|secret|authorization|cookie|card_number|cvv|ssn)/i.test(key))
				.slice(0, 200)
				.map(([key, item]) => [key, sanitizeMetadata(item, depth + 1)]),
		);
	}
	return String(value);
}

function toEventArray(body: unknown): IncomingAnalyticsEvent[] {
	const bodyRecord = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
	const rawEvents: unknown[] = Array.isArray(body)
		? body
		: Array.isArray(bodyRecord?.events)
			? bodyRecord.events
			: [body];

	return rawEvents
		.filter((event): event is IncomingAnalyticsEvent => Boolean(event) && typeof event === "object" && !Array.isArray(event))
		.slice(0, 50);
}

function cleanEvent(event: IncomingAnalyticsEvent, request: Request, user: { id: string; email?: string | null } | null) {
	const clean: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(event)) {
		if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) continue;
		if (key === "metadata") {
			clean.metadata = sanitizeMetadata(value || {});
		} else {
			clean[key] = truncateString(value);
		}
	}

	clean.event_name = typeof clean.event_name === "string" && clean.event_name.trim() ? clean.event_name.trim() : "unknown_event";
	clean.event_type = typeof clean.event_type === "string" && clean.event_type.trim() ? clean.event_type.trim() : "interaction";
	clean.event_source = typeof clean.event_source === "string" && clean.event_source.trim() ? clean.event_source.trim() : "frontend";
	clean.event_version = typeof clean.event_version === "string" && clean.event_version.trim() ? clean.event_version.trim() : "1.0";
	clean.session_id = typeof clean.session_id === "string" && clean.session_id.trim() ? clean.session_id.trim() : "unknown_session";
	clean.is_authenticated = Boolean(user);
	clean.user_id = user?.id || null;
	clean.user_email = user?.email || null;

	// Keep analytics focused on product behavior. Do not attach raw request/header objects.
	clean.metadata = (clean.metadata as Record<string, unknown>) || {};

	return clean;
}

export async function POST(request: Request) {
	try {
		const supabaseAuth = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabaseAuth.auth.getUser();

		const body = await request.json().catch(() => null);
		const events = toEventArray(body);
		if (!events.length) {
			return NextResponse.json({ error: "No analytics events provided" }, { status: 400 });
		}

		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !serviceRoleKey) {
			return NextResponse.json({ error: "Analytics is not configured" }, { status: 500 });
		}

		const adminClient = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false },
		});

		const rows = events.map((event) => cleanEvent(event, request, user ? { id: user.id, email: user.email } : null));
		const { error } = await adminClient.from("analytics_events").insert(rows);

		if (error) {
			console.error("Analytics insert error:", error);
			return NextResponse.json({ error: "Could not save analytics event" }, { status: 500 });
		}

		return NextResponse.json({ success: true, inserted: rows.length });
	} catch (error) {
		console.error("Analytics route error:", error);
		return NextResponse.json({ error: "Analytics route failed" }, { status: 500 });
	}
}
