/** @format */

"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
	getScrollDepthPercent,
	trackAnalyticsEvent,
	trackClientError,
	trackPageExit,
	trackPageView,
} from "@/utils/analytics/client";

function currentPath() {
	if (typeof window === "undefined") return "";
	return `${window.location.pathname}${window.location.search}`;
}

function shouldIgnoreAnalyticsPath(path: string) {
	return path.startsWith("/admin");
}

function shouldIgnoreCurrentPage() {
	return typeof window !== "undefined" && shouldIgnoreAnalyticsPath(window.location.pathname);
}

function trackActiveHeartbeat(pageStartedAt: number, pagePath: string) {
	if (shouldIgnoreCurrentPage()) return;
	trackAnalyticsEvent("active_heartbeat", {
		event_type: "presence",
		metadata: {
			visibility_state: document.visibilityState,
			current_page_started_at: new Date(pageStartedAt).toISOString(),
			current_page_duration_ms: Math.max(0, Date.now() - pageStartedAt),
			current_page_path: pagePath,
		},
	});
}

export default function AnalyticsTracker() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const pageStartedAtRef = useRef(Date.now());
	const currentPageRef = useRef("");
	const maxScrollDepthRef = useRef(0);
	const previousPathRef = useRef<string | null>(null);

	useEffect(() => {
		const nextPath = currentPath();
		const previousPath = currentPageRef.current || previousPathRef.current;
		const now = Date.now();
		const ignoreNextPath = shouldIgnoreAnalyticsPath(window.location.pathname);

		if (currentPageRef.current && !shouldIgnoreAnalyticsPath(currentPageRef.current)) {
			trackPageExit({
				pagePath: currentPageRef.current,
				nextPagePath: ignoreNextPath ? null : nextPath,
				durationMs: now - pageStartedAtRef.current,
				maxScrollDepthPercent: maxScrollDepthRef.current,
				exitReason: "route_change",
				transport: "fetch",
			});
		}

		if (ignoreNextPath) {
			currentPageRef.current = "";
			previousPathRef.current = previousPath || null;
			return;
		}

		pageStartedAtRef.current = now;
		currentPageRef.current = nextPath;
		previousPathRef.current = previousPath || null;
		maxScrollDepthRef.current = getScrollDepthPercent() || 0;
		trackPageView(previousPath && !shouldIgnoreAnalyticsPath(previousPath) ? previousPath : null);
	}, [pathname, searchParams]);

	useEffect(() => {
		const onScroll = () => {
			if (shouldIgnoreCurrentPage()) return;
			maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, getScrollDepthPercent() || 0);
		};

		const onPageHide = () => {
			if (shouldIgnoreCurrentPage()) return;
			trackPageExit({
				pagePath: currentPageRef.current || currentPath(),
				durationMs: Date.now() - pageStartedAtRef.current,
				maxScrollDepthPercent: maxScrollDepthRef.current,
				exitReason: "page_hide",
				transport: "beacon",
			});
		};

		const onError = (event: ErrorEvent) => {
			if (shouldIgnoreCurrentPage()) return;
			trackAnalyticsEvent("frontend_error", {
				event_type: "error",
				error_name: event.error?.name || "ErrorEvent",
				error_message: event.message,
				error_stack: event.error?.stack || null,
				metadata: {
					filename: event.filename,
					lineno: event.lineno,
					colno: event.colno,
				},
			});
		};

		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			if (shouldIgnoreCurrentPage()) return;
			trackClientError(event.reason, { source: "unhandledrejection" });
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("pagehide", onPageHide);
		window.addEventListener("error", onError);
		window.addEventListener("unhandledrejection", onUnhandledRejection);

		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("pagehide", onPageHide);
			window.removeEventListener("error", onError);
			window.removeEventListener("unhandledrejection", onUnhandledRejection);
		};
	}, []);

	useEffect(() => {
		if (shouldIgnoreCurrentPage()) return;

		const interval = window.setInterval(() => {
			if (document.visibilityState === "visible") {
			trackActiveHeartbeat(pageStartedAtRef.current, currentPageRef.current || currentPath());
		}
		}, 30000);

		return () => window.clearInterval(interval);
	}, [pathname, searchParams]);

	return null;
}
