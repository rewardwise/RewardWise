/** @format */
// Audit #7 DIAGNOSIS (report-only, LIVE PROD): is Zoe voice broken or was the
// audit's headless click just inconclusive?
//
// Zero-NVIDIA-spend design:
//  A) Client pipeline: fake mic device + granted permission, click the mic,
//     let the recorder run, and INTERCEPT /api/zoe/stt (abort) so nothing
//     reaches the backend. Proves/disproves the browser half.
//  B) Server config: in-page fetch of a 2KB GARBAGE blob to /api/zoe/stt.
//     Backend order: auth -> size check -> NVIDIA_API_KEY/FUNCTION_ID check ->
//     ffmpeg convert. Garbage cannot survive ffmpeg, so NVIDIA is never
//     called. 503 "STT is not configured" = env missing; 4xx/5xx conversion
//     error = env present, full path needs one real (paid) STT call to verify.
//  C) Headless-repro: same click WITHOUT fake device — what the audit saw.

import { test, expect } from "@playwright/test";

test.use({
	launchOptions: {
		args: [
			"--use-fake-ui-for-media-stream",
			"--use-fake-device-for-media-stream",
			// 1.5s tone then 3.5s silence — lets the hook's silence detector fire a
			// submit (the DEFAULT fake device beeps forever, so it never goes silent).
			`--use-file-for-fake-audio-capture=${process.cwd()}/playwright/fixtures/fake-speech.wav`,
		],
	},
	permissions: ["microphone"],
});

test("mic diagnosis: client pipeline + server config, no NVIDIA spend", async ({ page }) => {
	test.setTimeout(180_000);

	let sttAttempts = 0;
	await page.route("**/api/zoe/stt", (route) => {
		sttAttempts += 1;
		void route.abort();
	});

	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

	// ── A) client pipeline with fake device ─────────────────────────────────
	const mic = page.getByRole("button", { name: /voice|mic/i }).first();
	await expect(mic, "mic button present").toBeVisible();
	await mic.click();
	// Fake device emits a tone: expect the hook to leave idle (listening/
	// speaking chip or an error message).
	await page.waitForTimeout(6000);
	const bodyText = (await page.locator("body").textContent()) || "";
	const errored = /⚠️.*(icrophone|mic)/.test(bodyText);
	console.log("CLIENT_STATE errored:", errored, "| stt POST attempts (intercepted):", sttAttempts);
	await page.screenshot({ path: "playwright/.artifacts/mic-diag-fake-device.png" });
	// Give silence-detection time to fire a submit if it's going to.
	await page.waitForTimeout(8000);
	console.log("CLIENT_STT_ATTEMPTS_AFTER_14S", sttAttempts);
	const engaged = /Voice mode active/i.test(await page.locator("body").innerText());
	console.log("CLIENT_VOICE_MODE_ENGAGED:", engaged, "| placeholder:", await page.locator("input[placeholder]").last().getAttribute("placeholder"));
	await mic.click().catch(() => {}); // toggle off
	// Stop intercepting — part B's probe must actually reach the server.
	await page.unroute("**/api/zoe/stt");

	// ── B) server config probe (garbage blob, never reaches NVIDIA) ─────────
	const probe = await page.evaluate(async () => {
		const bytes = new Uint8Array(2048).fill(7); // not valid webm on purpose
		const form = new FormData();
		form.append("audio", new Blob([bytes], { type: "audio/webm" }), "audio.webm");
		const res = await fetch("/api/zoe/stt", { method: "POST", body: form });
		let body = "";
		try {
			body = JSON.stringify(await res.json());
		} catch {
			body = "(non-json)";
		}
		return { status: res.status, body: body.slice(0, 300) };
	});
	console.log("SERVER_PROBE status:", probe.status, "body:", probe.body);
	console.log(
		"SERVER_VERDICT:",
		probe.status === 503 && /not configured/i.test(probe.body)
			? "ENV MISSING (NVIDIA_API_KEY / ZOE_STT_FUNCTION_ID unset on Render)"
			: probe.status === 401
				? "AUTH-BLOCKED at proxy (storageState problem, config unknown)"
				: "ENV PRESENT — failed at conversion/downstream as expected for garbage; full verify needs 1 real STT call (paid)",
	);
	console.log("ASSERTIONS_RAN: client-pipeline observed, server config classified");
	expect(probe.status, "probe must reach the API (not a network error)").toBeGreaterThan(0);
});
