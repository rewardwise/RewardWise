/** @format */
// VOICE LIVE VERIFICATION part 1 (LIVE PROD, ~1 paid NVIDIA STT call,
// operator-approved): real spoken clip -> mic -> Parakeet STT -> transcript ->
// is_new_trip classifier -> deterministic ack (no dual-source pricing) ->
// trip extractor fills the form from the TRANSCRIPT.
// Closes audit #7 (real spoken turn on prod) + the voice-extractor path.

import { test, expect } from "@playwright/test";

test.use({
	launchOptions: {
		args: [
			"--use-fake-ui-for-media-stream",
			"--use-fake-device-for-media-stream",
			`--use-file-for-fake-audio-capture=${process.cwd()}/playwright/fixtures/spoken-newtrip.wav`,
		],
	},
	permissions: ["microphone"],
});

test("spoken new-trip request: real STT, deterministic ack, form filled", async ({ page }) => {
	test.setTimeout(240_000);

	let sttTranscript = "";
	let voiceFlag: string | null = null;
	const upstreamSearches: string[] = [];
	page.on("request", (req) => {
		if (/\/api\/(search|return-flight)/.test(req.url())) upstreamSearches.push(req.url());
		if (req.url().includes("/api/zoe/voice") && req.method() === "POST") {
			// multipart body: pull the is_new_trip form field out of the raw post data
			const m = (req.postData() || "").match(/name="is_new_trip"\s*\r?\n\r?\n(\w+)/);
			voiceFlag = m ? m[1] : "(field missing)";
		}
	});
	page.on("response", async (res) => {
		if (res.url().includes("/api/zoe/stt") && res.request().method() === "POST") {
			try { sttTranscript = (await res.json())?.transcript ?? ""; } catch { /* ignore */ }
		}
	});

	await page.goto("/home");
	const mic = page.getByRole("button", { name: "Start voice conversation" }).first();
	await expect(mic).toBeVisible();

	const voiceResponse = page.waitForResponse(
		(r) => r.url().includes("/api/zoe/voice") && r.request().method() === "POST",
		{ timeout: 120_000 },
	);
	await mic.click();
	const vres = await voiceResponse;
	// Toggle OFF promptly — the fake-audio file loops and would re-trigger STT.
	await page.getByRole("button", { name: "Exit voice mode" }).first().click().catch(() => {});

	console.log("STT_TRANSCRIPT >>>", sttTranscript, "<<<");
	console.log("VOICE_FLAG_is_new_trip:", voiceFlag);
	const replyB64 = vres.headers()["x-reply-b64"] || "";
	const reply = replyB64 ? Buffer.from(replyB64, "base64").toString("utf8") : vres.headers()["x-reply"] || "";
	console.log("VOICE_REPLY >>>", reply, "<<<");

	// 1. Real STT produced the trip statement
	expect(sttTranscript.toLowerCase()).toContain("denver");
	expect(sttTranscript.toLowerCase()).toContain("austin");
	// 2. Classifier flagged it on the wire
	expect(voiceFlag, "is_new_trip must ride the voice form").toBe("true");
	// 3. Deterministic ack — no dual-source pricing
	expect(reply).toContain("pulling live cash and points prices");
	expect(reply.match(/\$\s?\d|\d[\d,]{2,}\s*(points|pts|miles)/i), "reply must not price").toBeNull();
	// 4. Extractor filled the form FROM THE TRANSCRIPT
	await page.waitForTimeout(1500);
	const airports = page.locator('input[placeholder="City or airport"]');
	const dates = page.locator('input[type="date"]');
	await expect(airports.nth(0)).toHaveValue(/DEN/i);
	await expect(airports.nth(1)).toHaveValue(/AUS/i);
	await expect(dates.nth(0)).toHaveValue("2026-09-10");
	await expect(dates.nth(1)).toHaveValue("2026-09-14");
	// 5. Fill-only: zero engine searches triggered
	expect(upstreamSearches, "no upstream search spend").toEqual([]);
	console.log("ASSERTIONS_RAN: stt, flag, ack, form-fill, zero-upstream");
	await page.screenshot({ path: "playwright/.artifacts/voice-1-newtrip.png" });
});
