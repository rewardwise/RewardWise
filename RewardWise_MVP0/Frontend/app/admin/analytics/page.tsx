/** @format */

import { redirect } from "next/navigation";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/utils/supabase/server";
import { isPmTesterEmail } from "@/utils/auth/pm-testers";
import AnalyticsChartsDashboard from "./AnalyticsChartsDashboard";

type SearchParams = Record<string, string | string[] | undefined>;

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
	zoe_message_id: string | null;
	zoe_conversation_id: string | null;
	zoe_user_message: string | null;
	zoe_assistant_response: string | null;
	zoe_success: boolean | null;
	zoe_error_message: string | null;
	feedback_rating: string | null;
	feedback_text: string | null;
	error_message: string | null;
	api_status_code: number | null;
	device_type: string | null;
	browser: string | null;
	metadata: Record<string, unknown> | null;
};

type PageInsight = { page: string; visits: number; exits: number; avgSeconds: number; totalMinutes: number; lastSeen: string };
type SessionPath = { sessionId: string; user: string; startedAt: string; durationSeconds: number; path: string[]; pageViews: number; zoeMessages: number; searches: number };
type ZoeConversation = { id: string; user: string; startedAt: string; messages: number; responses: number; lastMessage: string; lastResponse: string; searchesTriggered: number };
type SearchInsight = { id: string; time: string; user: string; route: string; trip: string; cabin: string; travelers: string; verdict: string; price: string; source: string };
type CountRow = { name: string; value: number };
type ActiveNowRow = { user: string; page: string; lastSeen: string; secondsAgo: number; sessionId: string; status: string; secondsOnCurrentPage: number; pageStartedAt: string };

export const dynamic = "force-dynamic";

const DISPLAY_LIMIT = 3500;

function firstParam(value: string | string[] | undefined, fallback = "") {
	if (Array.isArray(value)) return value[0] ?? fallback;
	return value ?? fallback;
}

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

function isPresenceEvent(event: AnalyticsEvent) {
	return lower(event.event_name) === "active_heartbeat";
}

function isSearchEvent(event: AnalyticsEvent) {
	return lower(event.event_name).startsWith("search_") || Boolean(event.search_origin || event.search_destination);
}

function isSearchSubmitted(event: AnalyticsEvent) {
	return lower(event.event_name) === "search_submitted";
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

function isFeedbackEvent(event: AnalyticsEvent) {
	return lower(event.event_name).includes("feedback") || Boolean(event.feedback_rating || event.feedback_text);
}

function isErrorEvent(event: AnalyticsEvent) {
	return lower(event.event_type) === "error" || lower(event.event_name).includes("error") || lower(event.event_name).includes("failed");
}

function isUsefulEvent(event: AnalyticsEvent) {
	return isPresenceEvent(event) || isPageView(event) || isPageExit(event) || isSearchEvent(event) || isZoeEvent(event) || isVerdictEvent(event) || isFeedbackEvent(event) || isErrorEvent(event);
}

const PAGE_LABELS: Record<string, string> = {
	"/": "Landing page",
	"/home": "Home",
	"/profile": "Profile",
	"/subscribe": "Subscribe",
	"/about": "About",
	"/trips": "Trips",
	"/history": "History",
	"/circle": "Circle",
	"/wallet": "Wallet",
	"/login": "Login",
	"/auth/callback": "Auth callback",
};

const AIRPORT_NAMES: Record<string, string> = {
	ATL: "Hartsfield-Jackson Atlanta International Airport",
	AUS: "Austin-Bergstrom International Airport",
	BNA: "Nashville International Airport",
	BOS: "Boston Logan International Airport",
	BWI: "Baltimore/Washington International Thurgood Marshall Airport",
	CDG: "Paris Charles de Gaulle Airport",
	CLT: "Charlotte Douglas International Airport",
	CUN: "Cancun International Airport",
	DCA: "Ronald Reagan Washington National Airport",
	DEN: "Denver International Airport",
	DFW: "Dallas Fort Worth International Airport",
	DOH: "Hamad International Airport",
	DXB: "Dubai International Airport",
	EWR: "Newark Liberty International Airport",
	FLL: "Fort Lauderdale-Hollywood International Airport",
	GRU: "Sao Paulo/Guarulhos International Airport",
	HND: "Tokyo Haneda Airport",
	IAD: "Washington Dulles International Airport",
	IAH: "George Bush Intercontinental Airport",
	IST: "Istanbul Airport",
	JFK: "John F. Kennedy International Airport",
	LAS: "Harry Reid International Airport",
	LAX: "Los Angeles International Airport",
	LGA: "LaGuardia Airport",
	LHR: "London Heathrow Airport",
	MCO: "Orlando International Airport",
	MEX: "Mexico City International Airport",
	MIA: "Miami International Airport",
	MSP: "Minneapolis-Saint Paul International Airport",
	NRT: "Tokyo Narita International Airport",
	ORD: "Chicago O'Hare International Airport",
	PHL: "Philadelphia International Airport",
	PHX: "Phoenix Sky Harbor International Airport",
	SAN: "San Diego International Airport",
	SEA: "Seattle-Tacoma International Airport",
	SFO: "San Francisco International Airport",
	SJU: "Luis Munoz Marin International Airport",
	TPA: "Tampa International Airport",
};

function humanPage(page: string | null | undefined) {
	if (!page) return "Unknown page";
	const cleanPath = page.split("?")[0]?.replace(/\/$/, "") || "/";
	if (PAGE_LABELS[cleanPath]) return PAGE_LABELS[cleanPath];
	const lastSegment = cleanPath.split("/").filter(Boolean).at(-1);
	return titleCase(lastSegment || cleanPath);
}

function airportLabel(value: string | null | undefined) {
	const raw = (value || "").trim();
	if (!raw) return "?";
	const code = raw.toUpperCase();
	if (/^[A-Z]{3}$/.test(code)) {
		return AIRPORT_NAMES[code] ? `${AIRPORT_NAMES[code]} (${code})` : `${code} airport (${code})`;
	}
	const codeMatch = raw.match(/([A-Z]{3})/);
	if (codeMatch?.[1]) {
		const matchedCode = codeMatch[1];
		return AIRPORT_NAMES[matchedCode] ? `${AIRPORT_NAMES[matchedCode]} (${matchedCode})` : raw;
	}
	return titleCase(raw);
}


function short(value: string | null | undefined, max = 140) {
	if (!value) return "-";
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatDateTime(value: string) {
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDay(date: Date) {
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function seconds(ms: number | null | undefined) {
	return Math.max(0, Math.round((ms ?? 0) / 1000));
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
	return `${airportLabel(origin)} → ${airportLabel(destination)}`;
}

function buildActivity(days: number, events: AnalyticsEvent[]) {
	const buckets = new Map<string, { day: string; pageViews: number; pageMinutes: number; searches: number; zoeMessages: number; zoeUses: number }>();
	for (let index = days - 1; index >= 0; index -= 1) {
		const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
		buckets.set(date.toISOString().slice(0, 10), { day: formatDay(date), pageViews: 0, pageMinutes: 0, searches: 0, zoeMessages: 0, zoeUses: 0 });
	}

	for (const event of events) {
		const key = new Date(event.created_at).toISOString().slice(0, 10);
		const bucket = buckets.get(key);
		if (!bucket) continue;
		if (isPageView(event)) bucket.pageViews += 1;
		if (isPageExit(event)) bucket.pageMinutes += Math.round(seconds(event.duration_ms) / 60);
		if (isSearchSubmitted(event)) bucket.searches += 1;
		if (isZoeMessage(event)) bucket.zoeMessages += 1;
		if (isZoeOpen(event)) bucket.zoeUses += 1;
	}
	return [...buckets.values()];
}

function buildPageInsights(events: AnalyticsEvent[]): PageInsight[] {
	const views = events.filter(isPageView);
	const exits = events.filter(isPageExit);
	const map = new Map<string, PageInsight & { totalSecondsRaw: number }>();

	for (const view of views) {
		const page = humanPage(view.page_path);
		const existing = map.get(page) ?? { page, visits: 0, exits: 0, avgSeconds: 0, totalMinutes: 0, totalSecondsRaw: 0, lastSeen: view.created_at };
		existing.visits += 1;
		if (new Date(view.created_at) > new Date(existing.lastSeen)) existing.lastSeen = view.created_at;
		map.set(page, existing);
	}
	for (const exit of exits) {
		const page = humanPage(exit.page_path);
		const existing = map.get(page) ?? { page, visits: 0, exits: 0, avgSeconds: 0, totalMinutes: 0, totalSecondsRaw: 0, lastSeen: exit.created_at };
		existing.exits += 1;
		existing.totalSecondsRaw += seconds(exit.duration_ms);
		existing.totalMinutes = Math.round(existing.totalSecondsRaw / 60);
		existing.avgSeconds = Math.round(existing.totalSecondsRaw / Math.max(existing.exits, 1));
		if (new Date(exit.created_at) > new Date(existing.lastSeen)) existing.lastSeen = exit.created_at;
		map.set(page, existing);
	}

	return [...map.values()].sort((a, b) => b.visits - a.visits || b.totalSecondsRaw - a.totalSecondsRaw);
}

function buildSessionPaths(events: AnalyticsEvent[]): SessionPath[] {
	const groups = new Map<string, AnalyticsEvent[]>();
	for (const event of events) {
		const key = event.session_id || `${event.user_email || "unknown"}-${new Date(event.created_at).toISOString().slice(0, 10)}`;
		groups.set(key, [...(groups.get(key) ?? []), event]);
	}

	return [...groups.entries()]
		.map(([sessionId, sessionEvents]) => {
			const sorted = sessionEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
			const rawPath = sorted.filter(isPageView).map((event) => humanPage(event.page_path));
			const path = rawPath.filter((page, index) => page !== rawPath[index - 1]);
			const durationSeconds = sorted.filter(isPageExit).reduce((sum, event) => sum + seconds(event.duration_ms), 0);
			return {
				sessionId,
				user: sorted[0]?.user_email || "Unknown user",
				startedAt: sorted[0]?.created_at || new Date().toISOString(),
				durationSeconds,
				path,
				pageViews: rawPath.length,
				zoeMessages: sorted.filter(isZoeMessage).length,
				searches: sorted.filter(isSearchSubmitted).length,
			};
		})
		.filter((session) => session.path.length)
		.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
		.slice(0, 8);
}

function buildZoeConversations(events: AnalyticsEvent[]): ZoeConversation[] {
	const zoe = events.filter(isZoeEvent);
	const groups = new Map<string, AnalyticsEvent[]>();
	for (const event of zoe) {
		const key = event.zoe_conversation_id || event.session_id || `${event.user_email || "unknown"}-${new Date(event.created_at).toISOString().slice(0, 10)}`;
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
				startedAt: sorted[0]?.created_at || new Date().toISOString(),
				messages: messages.length,
				responses: responses.length,
				lastMessage: short([...messages].reverse()[0]?.zoe_user_message, 160),
				lastResponse: short([...responses].reverse()[0]?.zoe_assistant_response, 160),
				searchesTriggered: sorted.filter((event) => lower(event.event_name) === "zoe_search_triggered").length,
			};
		})
		.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
		.slice(0, 8);
}

function activeStatus(event: AnalyticsEvent) {
	if (isZoeMessage(event) || isZoeResponse(event) || isZoeOpen(event)) return "Using Zoe";
	if (isSearchSubmitted(event)) return "Searching routes";
	if (isVerdictEvent(event)) return "Viewing a verdict";
	if (isPageView(event) || isPresenceEvent(event)) return `Viewing ${humanPage(event.page_path)}`;
	return "Active";
}

function samePage(a: string | null | undefined, b: string | null | undefined) {
	return humanPage(a) === humanPage(b);
}

function metadataIsoDate(event: AnalyticsEvent, key: string) {
	const value = event.metadata?.[key];
	return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function buildActiveNow(events: AnalyticsEvent[]): ActiveNowRow[] {
	const activeWindowMs = 2 * 60 * 1000;
	const now = Date.now();
	const groups = new Map<string, AnalyticsEvent[]>();

	for (const event of events) {
		if (!event.user_email) continue;
		const key = event.user_id || event.user_email;
		groups.set(key, [...(groups.get(key) ?? []), event]);
	}

	return [...groups.values()]
		.map((userEvents) => {
			const sorted = [...userEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
			const latestOverall = sorted[0];
			if (!latestOverall || isPageExit(latestOverall)) return null;

			const latestActive = sorted.find((event) => isPresenceEvent(event) || isPageView(event) || isSearchSubmitted(event) || isZoeEvent(event) || isVerdictEvent(event));
			if (!latestActive) return null;

			const secondsAgo = Math.max(0, Math.round((now - new Date(latestActive.created_at).getTime()) / 1000));
			if (secondsAgo * 1000 > activeWindowMs) return null;

			const latestPageView = sorted.find(
				(event) =>
					isPageView(event) &&
					(!latestActive.session_id || event.session_id === latestActive.session_id) &&
					samePage(event.page_path, latestActive.page_path),
			);
			const pageStartedAtIso = metadataIsoDate(latestActive, "current_page_started_at") || latestPageView?.created_at || latestActive.created_at;
			const pageStartedAtMs = new Date(pageStartedAtIso).getTime();
			const secondsOnCurrentPage = Math.max(0, Math.round((now - pageStartedAtMs) / 1000));

			return {
				user: latestActive.user_email || "Unknown user",
				page: humanPage(latestActive.page_path),
				lastSeen: formatDateTime(latestActive.created_at),
				secondsAgo,
				sessionId: latestActive.session_id || "unknown",
				status: activeStatus(latestActive),
				secondsOnCurrentPage,
				pageStartedAt: formatDateTime(pageStartedAtIso),
			};
		})
		.filter((row): row is ActiveNowRow => Boolean(row))
		.sort((a, b) => a.secondsAgo - b.secondsAgo);
}

function groupCount(items: string[], limit = 10): CountRow[] {
	const map = new Map<string, number>();
	for (const item of items) map.set(item || "Unknown", (map.get(item || "Unknown") ?? 0) + 1);
	return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

export default async function AnalyticsAdminPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
	const params = (await searchParams) ?? {};
	const days = Math.min(Math.max(Number(firstParam(params.days, "30")) || 30, 1), 90);
	const selectedUser = firstParam(params.user, "");

	const userClient = await createUserClient();
	const { data: { user } } = await userClient.auth.getUser();
	if (!user) redirect("/login");

	if (!isPmTesterEmail(user.email)) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
				<div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
					<h1 className="text-2xl font-semibold">Admin analytics is restricted</h1>
					<p className="mt-3 text-sm text-slate-500">This dashboard is only visible to emails listed in PM_TESTER_EMAILS.</p>
				</div>
			</div>
		);
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceKey) {
		return <div className="min-h-screen bg-slate-50 p-10 text-red-700">Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.</div>;
	}

	const admin = createSupabaseAdminClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
	let query = admin.from("analytics_events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(DISPLAY_LIMIT);
	if (selectedUser) query = query.or(`user_id.eq.${selectedUser},user_email.eq.${selectedUser}`);

	const { data, error } = await query;
	const events = ((data ?? []) as AnalyticsEvent[]).filter((event) => event && !isAdminEvent(event) && isUsefulEvent(event));
	const chronological = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

	const pageViews = events.filter(isPageView);
	const pageExits = events.filter(isPageExit);
	const searches = events.filter(isSearchSubmitted);
	const zoeMessages = events.filter(isZoeMessage);
	const zoeUses = events.filter(isZoeOpen);
	const verdicts = events.filter(isVerdictEvent);
	const errors = events.filter(isErrorEvent);
	const sessions = new Set(events.map((event) => event.session_id).filter(Boolean));
	const activeUsers = new Set(events.map((event) => event.user_id || event.user_email).filter(Boolean));
	const pageInsights = buildPageInsights(events);
	const totalPageSeconds = pageExits.reduce((sum, event) => sum + seconds(event.duration_ms), 0);
	const zoeConversations = buildZoeConversations(events);
	const avgMessagesPerZoeChat = zoeConversations.length ? zoeConversations.reduce((sum, chat) => sum + chat.messages, 0) / zoeConversations.length : 0;

	const users = [...new Map(events.filter((event) => event.user_email).map((event) => [event.user_id || event.user_email || "unknown", event.user_email || "Unknown user"])).entries()]
		.map(([id, email]) => ({ userId: id, email }))
		.sort((a, b) => a.email.localeCompare(b.email));
	const selectedUserLabel = users.find((option) => option.userId === selectedUser || option.email === selectedUser)?.email ?? "All users";

	const recentSearches: SearchInsight[] = searches.slice(0, 9).map((event) => ({
		id: event.id,
		time: formatDateTime(event.created_at),
		user: event.user_email || "Unknown user",
		route: routeLabel(event),
		trip: titleCase(event.search_trip_type),
		cabin: titleCase(event.search_cabin),
		travelers: event.search_travelers ? String(event.search_travelers) : "-",
		verdict: titleCase(event.verdict_recommendation),
		price: event.cash_price ? `$${Math.round(event.cash_price)}` : "-",
		source: event.search_trigger_source || "manual",
	}));

	return (
		<AnalyticsChartsDashboard
			error={error?.message ?? null}
			filters={{ days, selectedUser, selectedUserLabel }}
			stats={{
				activeUsers: activeUsers.size,
				sessions: sessions.size,
				pageViews: pageViews.length,
				totalPageSeconds,
				avgPageSeconds: pageExits.length ? Math.round(totalPageSeconds / pageExits.length) : 0,
				searches: searches.length,
				zoeUses: zoeUses.length,
				zoeMessages: zoeMessages.length,
				zoeConversations: zoeConversations.length,
				avgMessagesPerZoeChat,
				verdicts: verdicts.length,
				errors: errors.length,
			}}
			options={{ users }}
			charts={{
				activityData: buildActivity(days, events),
				pageVisits: pageInsights.map((page) => ({ name: page.page, value: page.visits })),
				pageTime: pageInsights.map((page) => ({ name: page.page, value: page.avgSeconds })),
				topRoutes: groupCount(searches.map(routeLabel), 50),
				zoeBreakdown: [
					{ name: "Opened Zoe", value: zoeUses.length },
					{ name: "Messages", value: zoeMessages.length },
					{ name: "Chats", value: zoeConversations.length },
				].filter((row) => row.value > 0),
				verdicts: groupCount(verdicts.map((event) => titleCase(event.verdict_recommendation)), 50),
			}}
			tables={{
				activeNow: buildActiveNow(events),
				pages: pageInsights,
				sessionPaths: buildSessionPaths(chronological),
				zoeConversations,
				recentSearches,
			}}
		/>
	);
}
