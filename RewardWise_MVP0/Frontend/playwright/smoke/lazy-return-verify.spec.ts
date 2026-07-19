/** @format */
// PR-B acceptance (LIVE PROD): To-Flight tab lazy-fetches real return legs.
// 1. No /api/return-flight request fires during search (baseline untouched).
// 2. Clicking To Flight fires the fetch and renders real carrier/times.
// Screenshots of both tabs.

import { test, expect } from "@playwright/test";

test("lazy return leg: fetch on tab click only, real carrier/times", async ({ page }) => {
	test.setTimeout(300_000);
	const returnCalls: string[] = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/return-flight")) returnCalls.push(req.url());
	});

	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});
	const d = page.locator('input[type="date"]');
	await d.nth(0).fill("2026-11-03");
	await d.nth(1).fill("2026-11-06");
	const a = page.locator('input[placeholder="City or airport"]');
	await a.nth(0).fill("TUS");
	await a.nth(0).press("Enter");
	await a.nth(1).fill("OKC");
	await a.nth(1).press("Enter");
	const sr = page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.request().method() === "POST",
		{ timeout: 180_000 }
	);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await sr;
	await page.waitForTimeout(7000);

	// 1. Baseline: zero return-flight calls during/after search.
	console.log("RETURN_CALLS_DURING_SEARCH", returnCalls.length);
	expect(returnCalls.length, "no return-flight call may fire before tab click").toBe(0);

	// From tab screenshot.
	const fromTab = page.getByTestId("flight-tab-from");
	await fromTab.scrollIntoViewIfNeeded();
	await page.screenshot({ path: "playwright/.artifacts/lazy-from-tab.png", fullPage: false });

	// 2. Click To Flight → fetch fires → real details render.
	const rfResp = page.waitForResponse((r) => r.url().includes("/api/return-flight"), {
		timeout: 60_000,
	});
	await page.getByTestId("flight-tab-to").click();
	const rf = await (await rfResp).json();
	console.log("RETURN_FLIGHT_LEGS", rf?.return_flight?.legs?.length ?? 0);
	await page.waitForTimeout(2500);

	const card = page.getByTestId("flight-card-return");
	await expect(card).toBeVisible();
	const text = (await card.textContent()) || "";
	console.log("RETURN_CARD_TEXT", JSON.stringify(text.slice(0, 300)));
	// Real detail = a flight number pattern (e.g. "AS 1314") and a time range.
	expect(text, "return card must show a real flight number").toMatch(/[A-Z0-9]{2}\s?\d{2,4}/);
	expect(text, "return card must show departure–arrival times").toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
	console.log("LAZY_CALLS_TOTAL", returnCalls.length);
	expect(returnCalls.length).toBe(1);

	await page.screenshot({ path: "playwright/.artifacts/lazy-to-tab.png", fullPage: false });
});
