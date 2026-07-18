/** @format */
// Phase 1a: CONTEXT-LADEN Zoe turn on LIVE PROD. Run a real search first (so
// verdictContext exists), then ask Zoe a question — _compose_xpectrum_query
// will prepend [Context]/[wallet] preamble. Capture the raw /api/zoe body to
// see whether context turns stay compact or go verbose.

import { test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";

test("phase1a: context-laden Zoe turn (search -> ask)", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	// 1. Real search so a verdict + verdictContext exist.
	const airportInputs = page.locator('input[placeholder="City or airport"]');
	await airportInputs.nth(0).fill("SFO");
	await airportInputs.nth(0).press("Enter");
	await airportInputs.nth(1).fill("SEA");
	await airportInputs.nth(1).press("Enter");
	const dateInputs = page.locator('input[type="date"]');
	await dateInputs.nth(0).fill("2026-08-15");
	await dateInputs.nth(1).fill("2026-08-18");

	const searchResp = page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.request().method() === "POST",
		{ timeout: 180_000 }
	);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await searchResp;
	await page.waitForTimeout(7000); // let verdict render + Zoe narration mount

	// 2. Ask Zoe with the verdict on screen — this is the context-laden turn.
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("Should I use my points for this trip?");

	const zoeResp = page.waitForResponse(
		(r) => r.url().includes("/api/zoe") && r.request().method() === "POST",
		{ timeout: 120_000 }
	);
	await page.getByRole("button", { name: "Send message" }).click();
	const resp = await zoeResp;
	const body = await resp.json();

	mkdirSync("playwright/.artifacts", { recursive: true });
	writeFileSync(
		"playwright/.artifacts/phase1-zoe-context-response.json",
		JSON.stringify(body, null, 2)
	);
	console.log("STATUS", resp.status());
	console.log("CTX_MESSAGE_VERBATIM_START");
	console.log(body.message);
	console.log("CTX_MESSAGE_VERBATIM_END");

	await page.waitForTimeout(3000);
	await page.screenshot({ path: "playwright/.artifacts/phase1-zoe-context.png", fullPage: false });
});
