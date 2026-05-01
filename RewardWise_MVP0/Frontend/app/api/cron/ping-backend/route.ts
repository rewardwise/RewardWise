/** @format */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TIMEOUT_MS = 20_000;

function getBackendBaseUrl() {
	return (
		process.env.BACKEND_KEEPALIVE_URL ||
		process.env.NEXT_PUBLIC_API_URL ||
		""
	).replace(/\/$/, "");
}

function getSafeHost(url: string) {
	try {
		return new URL(url).host;
	} catch {
		return "unknown";
	}
}

function isAuthorized(req: NextRequest) {
	const cronSecret = process.env.CRON_SECRET;
	const authHeader = req.headers.get("authorization");

	// Local dev convenience: allow manual testing without a secret.
	if (process.env.NODE_ENV !== "production" && !cronSecret) {
		return true;
	}

	if (!cronSecret) {
		return false;
	}

	return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
	if (!isAuthorized(req)) {
		return NextResponse.json(
			{
				error: "Unauthorized cron request",
				message:
					"Set CRON_SECRET in Vercel and let Vercel Cron call this endpoint.",
			},
			{ status: 401 },
		);
	}

	const backendBaseUrl = getBackendBaseUrl();

	if (!backendBaseUrl) {
		return NextResponse.json(
			{
				error: "Missing backend URL",
				message:
					"Set BACKEND_KEEPALIVE_URL or NEXT_PUBLIC_API_URL in the frontend environment.",
			},
			{ status: 500 },
		);
	}

	const healthUrl = `${backendBaseUrl}/api/health`;
	const startedAt = Date.now();

	try {
		const response = await fetch(healthUrl, {
			method: "GET",
			cache: "no-store",
			headers: {
				"User-Agent": "mytravelwallet-backend-keepalive/1.0",
				Accept: "application/json,text/plain,*/*",
			},
			signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
		});

		const latencyMs = Date.now() - startedAt;
		const bodyText = await response.text().catch(() => "");

		return NextResponse.json(
			{
				success: response.ok,
				backend_host: getSafeHost(backendBaseUrl),
				status: response.status,
				latency_ms: latencyMs,
				checked_at: new Date().toISOString(),
				preview: bodyText.slice(0, 300),
			},
			{ status: response.ok ? 200 : 502 },
		);
	} catch (error) {
		const latencyMs = Date.now() - startedAt;
		const message =
			error instanceof Error ? error.message : "Unknown keepalive error";

		return NextResponse.json(
			{
				success: false,
				backend_host: getSafeHost(backendBaseUrl),
				latency_ms: latencyMs,
				checked_at: new Date().toISOString(),
				error: message,
			},
			{ status: 502 },
		);
	}
}
