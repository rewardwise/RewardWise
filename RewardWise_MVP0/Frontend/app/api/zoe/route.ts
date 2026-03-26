/** @format */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
	try {
		const body = await req.json();

		const res = await fetch("http://127.0.0.1:8000/api/zoe", {
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
