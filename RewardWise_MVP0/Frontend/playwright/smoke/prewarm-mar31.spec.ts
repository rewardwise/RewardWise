/** @format */
// Pre-warm: SEA→Tokyo Mar 15–31 2027, 2 travelers, economy — the operator's
// stated demo dates (the demo-readiness spec warms the Mar 15–30 variant).
// Payload cache is params-keyed EXACTLY, so each date pair needs its own warm.
import { test, expect } from "@playwright/test";

test("prewarm SEA→Tokyo Mar 15–31 ×2 economy", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("Tokyo"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-15");
	await d.nth(1).fill("2027-03-31");
	await page.getByTestId("more-options-toggle").click();
	await page.locator("select").first().selectOption("2");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	console.log("WARM Mar15-31 | rec:", body?.verdict?.recommendation, "| cash:", body?.cash_price, "| warmed-at:", new Date().toISOString());
	expect(body?.cash_price, "real cash data (quota restored)").not.toBeNull();
});
