/** @format */

export type AnalyticsEventPayload = {
	event_name: string;
	event_type?: string;
	event_source?: string;
	page_path?: string | null;
	page_url?: string | null;
	page_title?: string | null;
	referrer?: string | null;
	previous_page_path?: string | null;
	next_page_path?: string | null;
	duration_ms?: number | null;
	latency_ms?: number | null;
	time_since_session_start_ms?: number | null;
	time_since_page_load_ms?: number | null;
	element_name?: string | null;
	element_type?: string | null;
	element_text?: string | null;
	element_id?: string | null;
	element_class?: string | null;
	element_role?: string | null;
	element_href?: string | null;
	element_label?: string | null;
	element_aria_label?: string | null;
	element_position_x?: number | null;
	element_position_y?: number | null;
	click_x?: number | null;
	click_y?: number | null;
	scroll_x?: number | null;
	scroll_y?: number | null;
	scroll_depth_percent?: number | null;
	max_scroll_depth_percent?: number | null;
	viewport_width?: number | null;
	viewport_height?: number | null;
	search_id?: string | null;
	search_origin?: string | null;
	search_destination?: string | null;
	search_depart_date?: string | null;
	search_return_date?: string | null;
	search_trip_type?: string | null;
	search_cabin?: string | null;
	search_travelers?: number | null;
	search_trigger_source?: string | null;
	search_provider?: string | null;
	search_success?: boolean | null;
	search_error_message?: string | null;
	verdict_id?: string | null;
	verdict_recommendation?: string | null;
	verdict_confidence?: string | null;
	cash_price?: number | null;
	award_points?: number | null;
	award_fees?: number | null;
	cents_per_point?: number | null;
	historical_price_label?: string | null;
	route_match_level?: string | null;
	zoe_message_id?: string | null;
	zoe_conversation_id?: string | null;
	zoe_user_message?: string | null;
	zoe_assistant_response?: string | null;
	zoe_detected_origin?: string | null;
	zoe_detected_destination?: string | null;
	zoe_detected_depart_date?: string | null;
	zoe_detected_return_date?: string | null;
	zoe_detected_cabin?: string | null;
	zoe_detected_trip_type?: string | null;
	zoe_missing_fields?: string[] | null;
	zoe_model_used?: string | null;
	zoe_success?: boolean | null;
	zoe_error_message?: string | null;
	feedback_id?: string | null;
	feedback_rating?: string | null;
	feedback_text?: string | null;
	feedback_context?: string | null;
	error_name?: string | null;
	error_message?: string | null;
	error_stack?: string | null;
	api_endpoint?: string | null;
	api_status_code?: number | null;
	api_method?: string | null;
	metadata?: Record<string, unknown>;
};

const ANALYTICS_ENDPOINT = "/api/analytics";
const SESSION_KEY = "mtw_analytics_session_id";
const SESSION_STARTED_AT_KEY = "mtw_analytics_session_started_at";
const ANONYMOUS_KEY = "mtw_analytics_anonymous_id";
const MAX_TEXT_LENGTH = 1000;
const MAX_METADATA_STRING_LENGTH = 4000;

type TrackOptions = Omit<AnalyticsEventPayload, "event_name"> & {
	transport?: "fetch" | "beacon";
};

function safeRandomId(prefix: string) {
	const cryptoObj = typeof window !== "undefined" ? window.crypto : undefined;
	const id = cryptoObj?.randomUUID?.() || Math.random().toString(36).slice(2);
	return `${prefix}_${id}`;
}

function readStorage(storage: Storage | undefined, key: string) {
	try {
		return storage?.getItem(key) || null;
	} catch {
		return null;
	}
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
	try {
		storage?.setItem(key, value);
	} catch {
		// Ignore blocked storage.
	}
}

export function getAnalyticsSessionId() {
	if (typeof window === "undefined") return "server";
	let id = readStorage(window.sessionStorage, SESSION_KEY);
	if (!id) {
		id = safeRandomId("sess");
		writeStorage(window.sessionStorage, SESSION_KEY, id);
		writeStorage(window.sessionStorage, SESSION_STARTED_AT_KEY, String(Date.now()));
	}
	return id;
}

export function getAnalyticsAnonymousId() {
	if (typeof window === "undefined") return null;
	let id = readStorage(window.localStorage, ANONYMOUS_KEY);
	if (!id) {
		id = safeRandomId("anon");
		writeStorage(window.localStorage, ANONYMOUS_KEY, id);
	}
	return id;
}

export function getAnalyticsSessionStartedAt() {
	if (typeof window === "undefined") return Date.now();
	const stored = Number(readStorage(window.sessionStorage, SESSION_STARTED_AT_KEY));
	if (Number.isFinite(stored) && stored > 0) return stored;
	const now = Date.now();
	writeStorage(window.sessionStorage, SESSION_STARTED_AT_KEY, String(now));
	return now;
}

function truncateText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
	if (typeof value !== "string") return value;
	return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
	if (depth > 5) return "[truncated]";
	if (value === null || value === undefined) return value;
	if (["string", "number", "boolean"].includes(typeof value)) {
		return typeof value === "string" ? truncateText(value, MAX_METADATA_STRING_LENGTH) : value;
	}
	if (Array.isArray(value)) {
		return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
	}
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([key]) => !/(password|token|secret|authorization|cookie|card_number|cvv|ssn)/i.test(key))
				.slice(0, 100)
				.map(([key, item]) => [key, sanitizeMetadata(item, depth + 1)]),
		);
	}
	return String(value);
}

function parseBrowser(userAgent: string) {
	if (/Edg\//.test(userAgent)) return "Edge";
	if (/Chrome\//.test(userAgent)) return "Chrome";
	if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
	if (/Firefox\//.test(userAgent)) return "Firefox";
	return "Unknown";
}

function parseOs(userAgent: string) {
	if (/Windows/i.test(userAgent)) return "Windows";
	if (/Mac OS X/i.test(userAgent)) return "macOS";
	if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
	if (/Android/i.test(userAgent)) return "Android";
	if (/Linux/i.test(userAgent)) return "Linux";
	return "Unknown";
}

function getDeviceType() {
	if (typeof window === "undefined") return "unknown";
	const width = window.innerWidth;
	if (width < 768) return "mobile";
	if (width < 1024) return "tablet";
	return "desktop";
}

function getConnectionInfo() {
	if (typeof navigator === "undefined") return {};
	const connection = (navigator as Navigator & {
		connection?: { effectiveType?: string; downlink?: number };
	}).connection;
	return {
		network_effective_type: connection?.effectiveType || null,
		network_downlink: connection?.downlink || null,
	};
}

export function getPageContext() {
	if (typeof window === "undefined") return {};
	return {
		page_path: `${window.location.pathname}${window.location.search}`,
		page_url: window.location.href,
		page_title: document.title,
		referrer: document.referrer || null,
		viewport_width: window.innerWidth,
		viewport_height: window.innerHeight,
		scroll_x: Math.round(window.scrollX),
		scroll_y: Math.round(window.scrollY),
	};
}

function getDeviceContext() {
	if (typeof window === "undefined") return {};
	const userAgent = navigator.userAgent;
	return {
		device_type: getDeviceType(),
		browser: parseBrowser(userAgent),
		os: parseOs(userAgent),
		user_agent: truncateText(userAgent, 2000),
		screen_width: window.screen?.width || null,
		screen_height: window.screen?.height || null,
		pixel_ratio: window.devicePixelRatio || null,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
		language: navigator.language || null,
		...getConnectionInfo(),
	};
}

export function getScrollDepthPercent() {
	if (typeof window === "undefined" || typeof document === "undefined") return null;
	const doc = document.documentElement;
	const body = document.body;
	const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
	const scrollHeight = Math.max(body.scrollHeight, doc.scrollHeight, body.offsetHeight, doc.offsetHeight);
	const viewportHeight = window.innerHeight || doc.clientHeight;
	const denominator = Math.max(scrollHeight - viewportHeight, 1);
	return Math.max(0, Math.min(100, Math.round((scrollTop / denominator) * 100)));
}

export function getElementAnalytics(target: EventTarget | null) {
	if (!(target instanceof Element)) return {};
	const element = target.closest("button,a,input,select,textarea,label,summary,[role='button'],[data-analytics-name]") || target;
	const htmlElement = element as HTMLElement;
	const rect = htmlElement.getBoundingClientRect?.();
	const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
	const input = element instanceof HTMLInputElement ? element : null;
	const unsafeInput = input && ["password", "email", "tel", "number"].includes(input.type);
	return {
		element_name:
			htmlElement.dataset.analyticsName ||
			htmlElement.getAttribute("name") ||
			htmlElement.getAttribute("aria-label") ||
			htmlElement.id ||
			element.tagName.toLowerCase(),
		element_type: element.tagName.toLowerCase(),
		element_text: isInput || unsafeInput ? null : (truncateText((htmlElement.innerText || htmlElement.textContent || "").trim(), 500) as string),
		element_id: htmlElement.id || null,
		element_class: truncateText(htmlElement.className?.toString?.() || null, 1000) as string | null,
		element_role: htmlElement.getAttribute("role"),
		element_href: element instanceof HTMLAnchorElement ? element.href : null,
		element_label: htmlElement.dataset.analyticsLabel || htmlElement.getAttribute("title"),
		element_aria_label: htmlElement.getAttribute("aria-label"),
		element_position_x: rect ? Math.round(rect.left + window.scrollX) : null,
		element_position_y: rect ? Math.round(rect.top + window.scrollY) : null,
	};
}

export function trackAnalyticsEvent(eventName: string, options: TrackOptions = {}) {
	if (typeof window === "undefined") return;
	const now = Date.now();
	const sessionStartedAt = getAnalyticsSessionStartedAt();
	const payload: AnalyticsEventPayload & {
		session_id: string;
		anonymous_id: string | null;
		visit_id: string;
		is_authenticated?: boolean;
	} = {
		session_id: getAnalyticsSessionId(),
		anonymous_id: getAnalyticsAnonymousId(),
		visit_id: getAnalyticsSessionId(),
		event_name: eventName,
		event_type: options.event_type || eventName.split("_")[0] || "interaction",
		event_source: options.event_source || "frontend",
		time_since_session_start_ms: options.time_since_session_start_ms ?? now - sessionStartedAt,
		time_since_page_load_ms:
			options.time_since_page_load_ms ??
			(typeof performance !== "undefined" ? Math.round(performance.now()) : null),
		...getPageContext(),
		...getDeviceContext(),
		...options,
		metadata: sanitizeMetadata(options.metadata || {}) as Record<string, unknown>,
	};
	delete (payload as Record<string, unknown>).transport;

	const body = JSON.stringify(payload);
	if (options.transport === "beacon" && navigator.sendBeacon) {
		navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([body], { type: "application/json" }));
		return;
	}

	void fetch(ANALYTICS_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
		keepalive: true,
	}).catch(() => {
		// Analytics should never break the app.
	});
}

export function trackPageView(previousPagePath?: string | null) {
	trackAnalyticsEvent("page_view", {
		event_type: "navigation",
		previous_page_path: previousPagePath || null,
		metadata: {
			visibility_state: document.visibilityState,
		},
	});
}

export function trackPageExit({
	pagePath,
	nextPagePath,
	durationMs,
	maxScrollDepthPercent,
	exitReason,
	transport = "beacon",
}: {
	pagePath: string;
	nextPagePath?: string | null;
	durationMs: number;
	maxScrollDepthPercent: number;
	exitReason: string;
	transport?: "fetch" | "beacon";
}) {
	trackAnalyticsEvent("page_exit", {
		event_type: "navigation",
		page_path: pagePath,
		next_page_path: nextPagePath || null,
		duration_ms: Math.max(0, Math.round(durationMs)),
		scroll_depth_percent: getScrollDepthPercent(),
		max_scroll_depth_percent: maxScrollDepthPercent,
		metadata: {
			exit_reason: exitReason,
			visibility_state: document.visibilityState,
		},
		transport,
	});
}

export function trackClientError(error: unknown, metadata: Record<string, unknown> = {}) {
	const err = error instanceof Error ? error : new Error(String(error));
	trackAnalyticsEvent("frontend_error", {
		event_type: "error",
		error_name: err.name,
		error_message: err.message,
		error_stack: err.stack || null,
		metadata,
	});
}
