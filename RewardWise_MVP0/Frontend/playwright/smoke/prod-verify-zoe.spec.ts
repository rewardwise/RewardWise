/** @format */
// Prod-verify for the Xpectrum base-URL path fix (/api/v1 -> /v1).
// Sends a real logged-in Zoe message on live prod and asserts the reply is a
// real answer, NOT the connection/trouble fallback. Reports the raw /api/zoe
// status + body so a post-fix stale-key (401 -> same _CONNECT_MSG) is visible
// alongside the Render logs.

import { test, expect } from "@playwright/test";

const FALLBACKS = [
	"I'm having trouble connecting right now", // _CONNECT_MSG (404/401/DNS/missing key)
	"I'm having a little trouble right now", // _FALLBACK_MSG (stream error / empty)
];

test("prod Zoe returns a real reply, not the connection fallback", async ({ page }) => {
	await page.goto("/home");
	// Kill animations so the forever-pulsing FAB is clickable.
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	// Desktop /home renders Zoe in the docked (always-open) pane — no FAB to click;
	// the input is directly visible in the right column.
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.waitFor({ state: "visible", timeout: 30_000 });
	await input.scrollIntoViewIfNeeded();
	await input.fill("Atlanta to Boston Aug 16-19");

	const respPromise = page.waitForResponse(
		(r) => r.url().includes("/api/zoe") && r.request().method() === "POST",
		{ timeout: 120_000 }
	);
	await page.getByRole("button", { name: "Send message" }).click();

	const resp = await respPromise;
	const status = resp.status();
	const body = await resp.json().catch(() => ({}));
	const msg = (body?.message ?? "").toString();

	// Surface raw result for the report + log cross-check.
	console.log("ZOE_HTTP_STATUS", status);
	console.log("ZOE_REPLY", JSON.stringify(msg.slice(0, 400)));

	expect(status, "proxy should return 200").toBe(200);
	const isFallback = FALLBACKS.some((f) => msg.includes(f));
	expect(isFallback, `Zoe still returned a fallback (path fix insufficient / stale key?): "${msg}"`).toBe(false);
	expect(msg.length, "Zoe reply should be non-empty").toBeGreaterThan(0);
});
