/** @format */

import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { isPmTesterEmail } from "@/utils/auth/pm-testers";

export const runtime = "nodejs";

type AnalyticsEvent = {
	id: string;
	created_at: string;
	user_id: string | null;
	user_email: string | null;
	session_id: string | null;
	event_name: string;
	event_type: string;
	page_path: string | null;
	previous_page_path: string | null;
	next_page_path: string | null;
	duration_ms: number | null;
	search_origin: string | null;
	search_destination: string | null;
	search_depart_date: string | null;
	search_return_date: string | null;
	search_trip_type: string | null;
	search_cabin: string | null;
	search_travelers: number | null;
	search_trigger_source: string | null;
	search_success: boolean | null;
	search_error_message: string | null;
	verdict_recommendation: string | null;
	verdict_confidence: string | null;
	cash_price: number | null;
	award_points: number | null;
	cents_per_point: number | null;
	zoe_conversation_id: string | null;
	zoe_user_message: string | null;
	zoe_assistant_response: string | null;
	zoe_success: boolean | null;
	zoe_error_message: string | null;
	feedback_rating: string | null;
	feedback_text: string | null;
	error_message: string | null;
	device_type: string | null;
	browser: string | null;
	metadata: Record<string, unknown> | null;
};

type CountRow = { name: string; value: number };

const MAX_EVENTS_FOR_CONTEXT = 10000;
const PAGE_SIZE = 1000;

function lower(value: string | null | undefined) {
	return (value ?? "").toLowerCase();
}

function isAdminEvent(event: AnalyticsEvent) {
	return lower(event.page_path).startsWith("/admin");
}

function isPageView(event: AnalyticsEvent) {
	return lower(event.event_name) === "page_view";
}

function isPageExit(event: AnalyticsEvent) {
	return lower(event.event_name) === "page_exit" || lower(event.event_name) === "page_duration";
}

function isSearchSubmitted(event: AnalyticsEvent) {
	return lower(event.event_name) === "search_submitted";
}

function isSearchEvent(event: AnalyticsEvent) {
	return lower(event.event_name).startsWith("search_") || Boolean(event.search_origin || event.search_destination);
}

function isZoeEvent(event: AnalyticsEvent) {
	return lower(event.event_name).startsWith("zoe_") || Boolean(event.zoe_user_message || event.zoe_assistant_response);
}

function isZoeOpen(event: AnalyticsEvent) {
	return ["zoe_opened", "zoe_expanded"].includes(lower(event.event_name));
}

function isZoeMessage(event: AnalyticsEvent) {
	return lower(event.event_name) === "zoe_message_sent" || Boolean(event.zoe_user_message);
}

function isZoeResponse(event: AnalyticsEvent) {
	return lower(event.event_name) === "zoe_response_received" || Boolean(event.zoe_assistant_response);
}

function isVerdictEvent(event: AnalyticsEvent) {
	return lower(event.event_name).includes("verdict") || Boolean(event.verdict_recommendation);
}

function isErrorEvent(event: AnalyticsEvent) {
	return lower(event.event_type) === "error" || lower(event.event_name).includes("error") || lower(event.event_name).includes("failed");
}

function isUsefulEvent(event: AnalyticsEvent) {
	return isPageView(event) || isPageExit(event) || isSearchEvent(event) || isZoeEvent(event) || isVerdictEvent(event) || isErrorEvent(event);
}

function seconds(ms: number | null | undefined) {
	return Math.max(0, Math.round((ms ?? 0) / 1000));
}

function pageLabel(page: string | null | undefined) {
	if (!page) return "Unknown page";
	if (page === "/") return "Landing page";
	return page;
}

function titleCase(value: string | null | undefined) {
	return (value || "Unknown")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function metadataText(event: AnalyticsEvent, key: string, fallback = "") {
	const value = event.metadata?.[key];
	return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function routeLabel(event: AnalyticsEvent) {
	const origin = event.search_origin || metadataText(event, "origin", "");
	const destination = event.search_destination || metadataText(event, "destination", "");
	if (!origin && !destination) return "Unknown route";
	return `${origin || "?"} → ${destination || "?"}`;
}

function short(value: string | null | undefined, max = 220) {
	if (!value) return "";
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function groupCount(items: string[], limit = 12): CountRow[] {
	const map = new Map<string, number>();
	for (const item of items) map.set(item || "Unknown", (map.get(item || "Unknown") ?? 0) + 1);
	return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function buildPageSummary(events: AnalyticsEvent[]) {
	const map = new Map<string, { page: string; visits: number; exits: number; totalSeconds: number; avgSeconds: number }>();
	for (const event of events) {
		if (!isPageView(event) && !isPageExit(event)) continue;
		const page = pageLabel(event.page_path);
		const row = map.get(page) ?? { page, visits: 0, exits: 0, totalSeconds: 0, avgSeconds: 0 };
		if (isPageView(event)) row.visits += 1;
		if (isPageExit(event)) {
			row.exits += 1;
			row.totalSeconds += seconds(event.duration_ms);
			row.avgSeconds = Math.round(row.totalSeconds / Math.max(row.exits, 1));
		}
		map.set(page, row);
	}
	return [...map.values()].sort((a, b) => b.visits - a.visits).slice(0, 15);
}

function buildSessionPaths(events: AnalyticsEvent[]) {
	const groups = new Map<string, AnalyticsEvent[]>();
	for (const event of events) {
		const key = event.session_id || `${event.user_email || "unknown"}-${event.created_at.slice(0, 10)}`;
		groups.set(key, [...(groups.get(key) ?? []), event]);
	}
	return [...groups.entries()]
		.map(([sessionId, sessionEvents]) => {
			const sorted = sessionEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
			const rawPath = sorted.filter(isPageView).map((event) => pageLabel(event.page_path));
			const path = rawPath.filter((page, index) => page !== rawPath[index - 1]);
			return {
				sessionId,
				user: sorted[0]?.user_email || "Unknown user",
				startedAt: sorted[0]?.created_at,
				durationSeconds: sorted.filter(isPageExit).reduce((sum, event) => sum + seconds(event.duration_ms), 0),
				path,
				pageViews: rawPath.length,
				searches: sorted.filter(isSearchSubmitted).length,
				zoeMessages: sorted.filter(isZoeMessage).length,
			};
		})
		.filter((session) => session.path.length)
		.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
		.slice(0, 30);
}

function buildZoeConversations(events: AnalyticsEvent[]) {
	const groups = new Map<string, AnalyticsEvent[]>();
	for (const event of events.filter(isZoeEvent)) {
		const key = event.zoe_conversation_id || event.session_id || `${event.user_email || "unknown"}-${event.created_at.slice(0, 10)}`;
		groups.set(key, [...(groups.get(key) ?? []), event]);
	}
	return [...groups.entries()]
		.map(([id, conversationEvents]) => {
			const sorted = conversationEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
			const messages = sorted.filter(isZoeMessage);
			const responses = sorted.filter(isZoeResponse);
			return {
				id,
				user: sorted[0]?.user_email || "Unknown user",
				startedAt: sorted[0]?.created_at,
				messages: messages.length,
				responses: responses.length,
				lastUserMessage: short([...messages].reverse()[0]?.zoe_user_message),
				lastAssistantResponse: short([...responses].reverse()[0]?.zoe_assistant_response),
				searchesTriggered: sorted.filter((event) => lower(event.event_name) === "zoe_search_triggered").length,
			};
		})
		.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
		.slice(0, 30);
}

function buildAnalyticsContext(events: AnalyticsEvent[], question: string, scope: { days: number; selectedUser: string }) {
	const pageViews = events.filter(isPageView);
	const pageExits = events.filter(isPageExit);
	const searches = events.filter(isSearchSubmitted);
	const zoeOpens = events.filter(isZoeOpen);
	const zoeMessages = events.filter(isZoeMessage);
	const verdicts = events.filter(isVerdictEvent);
	const errors = events.filter(isErrorEvent);
	const users = groupCount(events.map((event) => event.user_email || "Unknown user"), 20);
	const zoeConversations = buildZoeConversations(events);

	return {
		question,
		scope: {
			days: scope.days,
			selectedUser: scope.selectedUser || "All users",
			eventsIncluded: events.length,
		},
		metrics: {
			activeUsers: new Set(events.map((event) => event.user_email || event.user_id).filter(Boolean)).size,
			sessions: new Set(events.map((event) => event.session_id).filter(Boolean)).size,
			pageViews: pageViews.length,
			avgPageSeconds: pageExits.length ? Math.round(pageExits.reduce((sum, event) => sum + seconds(event.duration_ms), 0) / pageExits.length) : 0,
			searches: searches.length,
			verdicts: verdicts.length,
			zoeOpens: zoeOpens.length,
			zoeMessages: zoeMessages.length,
			zoeConversations: zoeConversations.length,
			avgMessagesPerZoeConversation: zoeConversations.length ? Number((zoeConversations.reduce((sum, chat) => sum + chat.messages, 0) / zoeConversations.length).toFixed(2)) : 0,
			errors: errors.length,
		},
		topUsers: users,
		pages: buildPageSummary(events),
		topRoutes: groupCount(searches.map(routeLabel), 15),
		verdicts: groupCount(verdicts.map((event) => titleCase(event.verdict_recommendation)), 10),
		searches: searches.slice(0, 50).map((event) => ({
			time: event.created_at,
			user: event.user_email || "Unknown user",
			route: routeLabel(event),
			tripType: titleCase(event.search_trip_type),
			cabin: titleCase(event.search_cabin),
			travelers: event.search_travelers,
			cashPrice: event.cash_price,
			verdict: titleCase(event.verdict_recommendation),
			source: event.search_trigger_source || "manual",
		})),
		zoeConversations,
		sessionPaths: buildSessionPaths(events),
		errors: errors.slice(0, 25).map((event) => ({
			time: event.created_at,
			user: event.user_email || "Unknown user",
			page: pageLabel(event.page_path),
			event: event.event_name,
			message: short(event.error_message || event.search_error_message || event.zoe_error_message, 220),
		})),
	};
}

async function fetchEvents(days: number, selectedUser: string) {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceKey) throw new Error("Analytics database is not configured.");

	const admin = createSupabaseAdminClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
	const allEvents: AnalyticsEvent[] = [];

	for (let from = 0; from < MAX_EVENTS_FOR_CONTEXT; from += PAGE_SIZE) {
		let query = admin
			.from("analytics_events")
			.select("id,created_at,user_id,user_email,session_id,event_name,event_type,page_path,previous_page_path,next_page_path,duration_ms,search_origin,search_destination,search_depart_date,search_return_date,search_trip_type,search_cabin,search_travelers,search_trigger_source,search_success,search_error_message,verdict_recommendation,verdict_confidence,cash_price,award_points,cents_per_point,zoe_conversation_id,zoe_user_message,zoe_assistant_response,zoe_success,zoe_error_message,feedback_rating,feedback_text,error_message,device_type,browser,metadata")
			.gte("created_at", since)
			.order("created_at", { ascending: false })
			.range(from, from + PAGE_SIZE - 1);
		if (selectedUser) query = query.or(`user_id.eq.${selectedUser},user_email.eq.${selectedUser}`);

		const { data, error } = await query;
		if (error) throw new Error(error.message);
		const rows = ((data ?? []) as AnalyticsEvent[]).filter((event) => event && !isAdminEvent(event) && isUsefulEvent(event));
		allEvents.push(...rows);
		if (!data || data.length < PAGE_SIZE) break;
	}

	return allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function callNvidia(question: string, context: unknown) {
	const apiKey = process.env.NVIDIA_API_KEY;
	const baseUrl = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
	const model = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

	if (!apiKey) {
		throw new Error("Missing NVIDIA_API_KEY. Add it to your frontend env vars before using Ask Analytics.");
	}

	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			temperature: 0.2,
			max_tokens: 900,
			messages: [
				{
					role: "system",
					content:
						"You are an internal product analytics copilot for MyTravelWallet. Answer only from the analytics JSON provided. Be concise, specific, and cite numbers from the data. If the selected scope is one user, answer only for that user. If data is missing, say so directly. Focus on pages visited, time spent, route paths, searches, verdicts, and Zoe usage. Do not mention raw database fields unless necessary.",
				},
				{
					role: "user",
					content: `Question: ${question}\n\nAnalytics data JSON:\n${JSON.stringify(context)}`,
				},
			],
		}),
		signal: AbortSignal.timeout(45_000),
	});

	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(data?.error?.message || data?.message || "NVIDIA analytics request failed.");
	}

	return data?.choices?.[0]?.message?.content || "No answer returned.";
}

export async function POST(request: Request) {
	try {
		const supabaseAuth = await createRouteHandlerClient();
		const { data: { user } } = await supabaseAuth.auth.getUser();
		if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		if (!isPmTesterEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

		const body = await request.json().catch(() => null);
		const question = typeof body?.question === "string" ? body.question.trim().slice(0, 1000) : "";
		const days = Math.min(Math.max(Number(body?.days) || 30, 1), 90);
		const selectedUser = typeof body?.selectedUser === "string" ? body.selectedUser.trim() : "";

		if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });

		const events = await fetchEvents(days, selectedUser);
		const context = buildAnalyticsContext(events, question, { days, selectedUser });
		const answer = await callNvidia(question, context);

		return NextResponse.json({ answer, contextStats: context.metrics });
	} catch (error) {
		console.error("Analytics ask error:", error);
		return NextResponse.json({ error: error instanceof Error ? error.message : "Analytics AI failed." }, { status: 500 });
	}
}
