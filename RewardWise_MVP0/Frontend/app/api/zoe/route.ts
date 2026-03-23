/** @format */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const { message } = await req.json();

	const prompt = `
Extract travel info from this message.

Return ONLY JSON.

Message: "${message}"

Format:
{
  "origin": "...",
  "destination": "...",
  "date": "...",
  "travelers": number,
  "cabin": "economy | business | first"
}
`;

	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: prompt }],
				temperature: 0,
			}),
		});

		const data = await response.json();
		const text = data.choices[0].message.content;

		return NextResponse.json(JSON.parse(text));
	} catch (err) {
		return NextResponse.json({ error: "LLM failed" }, { status: 500 });
	}
}
