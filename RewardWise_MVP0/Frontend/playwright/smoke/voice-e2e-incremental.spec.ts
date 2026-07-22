/** @format */
// VOICE LIVE VERIFICATION part 2 (LIVE PROD, ~1 paid NVIDIA STT call,
// operator-approved): spoken INCREMENTAL update ("What about the 20th
// instead?") with form context -> only the depart date changes.

import { test, expect } from "@playwright/test";

test.use({
	launchOptions: {
		args: [
			"--use-fake-ui-for-media-stream",
			"--use-fake-device-for-media-stream",
			`--use-file-for-fake-audio-capture=${process.cwd()}/playwright/fixtures/spoken-incremental.wav`,
		],
	},
	permissions: ["microphone"],
});

test("spoken incremental update: only the depart date changes", async ({ page }) => {
	test.setTimeout(240_000);

	let sttTranscript = "";
	page.on("response", async (res) => {
		if (res.url().includes("/api/zoe/stt") && res.request().method() === "POST") {
			try { sttTranscript = (await res.json())?.transcript ?? ""; } catch { /* ignore */ }
		}
	});

	await page.goto("/home");
	// Establish form context first (the classifier + extractor borrow month/year
	// from the current form dates).
	const dates = page.locator('input[type="date"]');
	await dates.nth(0).fill("2026-09-10");
	await dates.nth(1).fill("2026-09-14");

	const mic = page.getByRole("button", { name: "Start voice conversation" }).first();
	const voiceResponse = page.waitForResponse(
		(r) => r.url().includes("/api/zoe/voice") && r.request().method() === "POST",
		{ timeout: 120_000 },
	);
	await mic.click();
	const vres = await voiceResponse;
	await page.getByRole("button", { name: "Exit voice mode" }).first().click().catch(() => {});

	const replyB64 = vres.headers()["x-reply-b64"] || "";
	const reply = replyB64 ? Buffer.from(replyB64, "base64").toString("utf8") : vres.headers()["x-reply"] || "";
	console.log("STT_TRANSCRIPT >>>", sttTranscript, "<<<");
	console.log("VOICE_REPLY >>>", reply.slice(0, 200), "<<<");

	await page.waitForTimeout(1500);
	await expect(dates.nth(0), "depart moved to the 20th").toHaveValue("2026-09-20");
	await expect(dates.nth(1), "return untouched").toHaveValue("2026-09-14");
	console.log("ASSERTIONS_RAN: stt transcript, depart-only fill");
	await page.screenshot({ path: "playwright/.artifacts/voice-2-incremental.png" });
});
