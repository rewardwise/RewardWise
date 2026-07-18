/** @format */
// Phase 1 investigation: capture the VERBATIM /api/zoe response body (which is
// the Xpectrum answer passed through untouched by the backend) for the exact
// query "SFO to SEA Aug 15-18, 1 traveler", on LIVE PROD, logged in. Also
// screenshot the rendered Zoe thread for the visual comparison.

import { test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";

test("phase1: raw Zoe answer for SFO->SEA Aug 15-18", async ({ page }) => {
	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.waitFor({ state: "visible", timeout: 30_000 });
	await input.scrollIntoViewIfNeeded();
	await input.fill("SFO to SEA Aug 15-18, 1 traveler");

	const respPromise = page.waitForResponse(
		(r) => r.url().includes("/api/zoe") && r.request().method() === "POST",
		{ timeout: 120_000 }
	);
	await page.getByRole("button", { name: "Send message" }).click();
	const resp = await respPromise;
	const body = await resp.json();

	mkdirSync("playwright/.artifacts", { recursive: true });
	writeFileSync("playwright/.artifacts/phase1-zoe-response.json", JSON.stringify(body, null, 2));
	console.log("STATUS", resp.status());
	console.log("MESSAGE_VERBATIM_START");
	console.log(body.message);
	console.log("MESSAGE_VERBATIM_END");

	// Let the thread render, then screenshot the Zoe pane.
	await page.waitForTimeout(3000);
	await page.screenshot({ path: "playwright/.artifacts/phase1-zoe-rendered.png", fullPage: false });
});
