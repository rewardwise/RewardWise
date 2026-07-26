/** @format */
// Phase-2 acceptance (LIVE PROD): stating a trip to Zoe fills the search form;
// a non-trip question leaves it untouched. Screenshots both.

import { test, expect } from "@playwright/test";

test("trip message fills the form", async ({ page }) => {
	test.setTimeout(240_000);
	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("I want to fly from Denver to Austin September 10 to 14 for 2 travelers");
	const z = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await z.catch(() => {});
	await page.waitForTimeout(1500);

	const airports = page.locator('input[placeholder="City or airport"]');
	const dates = page.locator('input[type="date"]');
	await expect(airports.nth(0)).toHaveValue(/DEN/i);
	await expect(airports.nth(1)).toHaveValue(/AUS/i);
	await expect(dates.nth(0)).toHaveValue("2026-09-10");
	await expect(dates.nth(1)).toHaveValue("2026-09-14");
	console.log("FILLED",
		await airports.nth(0).inputValue(), "->", await airports.nth(1).inputValue(),
		await dates.nth(0).inputValue(), "..", await dates.nth(1).inputValue());
	await page.screenshot({ path: "playwright/.artifacts/autofill-trip.png", fullPage: false });
});

test("non-trip message leaves the form untouched", async ({ page }) => {
	test.setTimeout(240_000);
	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

	const airports = page.locator('input[placeholder="City or airport"]');
	const dates = page.locator('input[type="date"]');
	const before = [
		await airports.nth(0).inputValue(),
		await airports.nth(1).inputValue(),
		await dates.nth(0).inputValue(),
		await dates.nth(1).inputValue(),
	];

	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("How do transfers work?");
	const z = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await z.catch(() => {});
	await page.waitForTimeout(1500);

	const after = [
		await airports.nth(0).inputValue(),
		await airports.nth(1).inputValue(),
		await dates.nth(0).inputValue(),
		await dates.nth(1).inputValue(),
	];
	console.log("BEFORE", JSON.stringify(before), "AFTER", JSON.stringify(after));
	expect(after).toEqual(before);
	await page.screenshot({ path: "playwright/.artifacts/autofill-nontrip.png", fullPage: false });
});
