/** @format */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	const backendUrl =
		process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

	try {
		await fetch(`${backendUrl}/api/health`, {
			method: "GET",
			cache: "no-store",
			signal: AbortSignal.timeout(60_000),
		});
	} catch {
	}

	return new NextResponse(null, {
		status: 204,
		headers: { "Cache-Control": "no-store" },
	});
}
