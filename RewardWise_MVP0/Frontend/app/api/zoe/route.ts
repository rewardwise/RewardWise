/** @format */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
	try {
		const body = await req.json();

		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

		const res = await fetch(`${backendUrl}/api/zoe`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const data = await res.json();

		return NextResponse.json(data);
	} catch (err) {
		console.error("API ERROR:", err);

		return NextResponse.json(
			{ message: "Backend not reachable" },
			{ status: 500 },
		);
	}
}