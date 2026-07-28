/** @format */
// Live verify: after a cabin-changed search the form's CABIN dropdown must
// mirror the searched/verdict cabin. Fails-pre evidence: demo-readiness run
// 2026-07-28 — verdict "premium economy" while the dropdown read "Economy"
// (async prefs seed stomped the in-flight edit; nothing re-synced the form).
import { test, expect } from "@playwright/test";

test("cabin dropdown syncs to searched cabin (premium economy, then business)", async ({ page }) => {
	test.setTimeout(600_000);
	await page.goto("/home");
	const zoe = page.getByPlaceholder("Tell Zoe about your trip…");
	await expect(zoe).toBeVisible({ timeout: 30_000 });

	// ── Premium economy via Zoe (complete fill → autorun) ───────────────────
	await zoe.fill("Seattle to San Diego September 3 to 6, premium economy, one traveler");
	const rp1 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	const body1 = await (await rp1).json();
	console.log("SEARCH1 cabin param echoed:", body1?.cabin, "| verdict:", body1?.verdict?.recommendation);
	await page.waitForTimeout(6000);

	// Open More options if collapsed, then read the REAL select value.
	const moreToggle = page.getByTestId("more-options-toggle");
	if (!(await page.getByTestId("more-options").isVisible().catch(() => false))) {
		await moreToggle.click();
	}
	const cabinSelect = page.locator('select:has(option[value="premium_economy"])');
	await expect(cabinSelect, "dropdown mirrors the searched cabin").toHaveValue("premium_economy", { timeout: 10_000 });
	const label1 = await cabinSelect.locator("option:checked").textContent();
	console.log("DROPDOWN after premium-economy search:", label1);
	await page.screenshot({ path: "playwright/.artifacts/cabin-sync-1-premium.png", fullPage: false });

	// ── "search business" rerun via Zoe ─────────────────────────────────────
	await zoe.fill("search business");
	const rp2 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	const body2 = await (await rp2).json();
	console.log("SEARCH2 verdict:", body2?.verdict?.recommendation);
	await page.waitForTimeout(6000);
	if (!(await page.getByTestId("more-options").isVisible().catch(() => false))) {
		await moreToggle.click();
	}
	await expect(cabinSelect, "dropdown mirrors the business rerun").toHaveValue("business", { timeout: 10_000 });
	const label2 = await cabinSelect.locator("option:checked").textContent();
	console.log("DROPDOWN after business rerun:", label2);
	const vtext = (await page.locator("body").textContent()) ?? "";
	expect(/business/i.test(vtext), "verdict card reflects business").toBe(true);
	await page.screenshot({ path: "playwright/.artifacts/cabin-sync-2-business.png", fullPage: false });
});
