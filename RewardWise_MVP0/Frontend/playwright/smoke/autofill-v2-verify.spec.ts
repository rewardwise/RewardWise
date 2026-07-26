/** @format */
// Autofill v2 acceptance (LIVE PROD): one session, four cases, zero upstream
// search calls throughout. Screenshots per case.

import { test, expect } from "@playwright/test";

test("autofill v2: full fill, incremental depart, incremental return, non-trip", async ({ page }) => {
	test.setTimeout(300_000);
	const upstream: string[] = [];
	page.on("request", (req) => {
		if (/\/api\/(search|return-flight|public-search)/.test(req.url())) upstream.push(req.url());
	});

	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
	const airports = page.locator('input[placeholder="City or airport"]');
	const dates = page.locator('input[type="date"]');
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	const send = page.getByRole("button", { name: "Send message" });

	const zoe = async (msg: string) => {
		await input.scrollIntoViewIfNeeded();
		await input.fill(msg);
		const p = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
		await send.click();
		await p.catch(() => {});
		await page.waitForTimeout(1200);
	};

	// 1. Full statement fills all fields
	await zoe("I want to fly from Denver to Austin September 10 to 14 for 2 travelers");
	await expect(airports.nth(0)).toHaveValue(/DEN/i);
	await expect(airports.nth(1)).toHaveValue(/AUS/i);
	await expect(dates.nth(0)).toHaveValue("2026-09-10");
	await expect(dates.nth(1)).toHaveValue("2026-09-14");
	console.log("CASE1_FULL_FILL ok");
	await page.screenshot({ path: "playwright/.artifacts/av2-1-full.png", fullPage: false });

	// 2. Incremental depart: only the depart date changes
	await zoe("what about the 20th instead?");
	await expect(dates.nth(0)).toHaveValue("2026-09-20");
	await expect(dates.nth(1)).toHaveValue("2026-09-14");
	await expect(airports.nth(0)).toHaveValue(/DEN/i);
	await expect(airports.nth(1)).toHaveValue(/AUS/i);
	console.log("CASE2_INCREMENTAL_DEPART ok (only depart changed)");
	await page.screenshot({ path: "playwright/.artifacts/av2-2-incr-depart.png", fullPage: false });

	// 3. Incremental return: only the return date changes
	await zoe("and can I come back on the 25th?");
	await expect(dates.nth(0)).toHaveValue("2026-09-20");
	await expect(dates.nth(1)).toHaveValue("2026-09-25");
	console.log("CASE3_INCREMENTAL_RETURN ok (only return changed)");
	await page.screenshot({ path: "playwright/.artifacts/av2-3-incr-return.png", fullPage: false });

	// 4. Non-trip: everything untouched
	const before = [await airports.nth(0).inputValue(), await airports.nth(1).inputValue(), await dates.nth(0).inputValue(), await dates.nth(1).inputValue()];
	await zoe("how do transfer ratios work?");
	const after = [await airports.nth(0).inputValue(), await airports.nth(1).inputValue(), await dates.nth(0).inputValue(), await dates.nth(1).inputValue()];
	expect(after).toEqual(before);
	console.log("CASE4_NONTRIP ok (form untouched)");
	await page.screenshot({ path: "playwright/.artifacts/av2-4-nontrip.png", fullPage: false });

	console.log("UPSTREAM_SEARCH_CALLS", upstream.length, JSON.stringify(upstream));
	expect(upstream, "zero search-upstream calls in the whole session").toEqual([]);
	console.log("ASSERTIONS_RAN: all four cases executed");
});
