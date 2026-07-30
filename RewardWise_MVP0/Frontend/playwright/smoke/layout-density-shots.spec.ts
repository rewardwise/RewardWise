/** @format */
// Layout density before/after captures: 1440 empty state, 1440 verdict state
// (?demo=1 frozen Mar 23 card), 375 empty. Pass SHOT_PREFIX=before|after.
import { test, expect } from "@playwright/test";

const P = process.env.SHOT_PREFIX || "before";

test(`${P}: 1440 empty state`, async ({ page }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/home");
	await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `playwright/.artifacts/density-${P}-1440-empty.png`, fullPage: true });
	await page.screenshot({ path: `playwright/.artifacts/density-${P}-1440-empty-viewport.png` });
});

test(`${P}: 1440 verdict state (demo)`, async ({ page }) => {
	test.setTimeout(180_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/home?demo=1");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("Tokyo"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SEA"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-23");
	await page.getByTestId("more-options-toggle").click();
	await page.getByRole("button", { name: /One Way/i }).click();
	await page.locator("select").nth(2).selectOption("business");
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await expect(page.getByText("Use points", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
	await page.waitForTimeout(3000);
	await page.screenshot({ path: `playwright/.artifacts/density-${P}-1440-verdict.png`, fullPage: true });
	await page.screenshot({ path: `playwright/.artifacts/density-${P}-1440-verdict-viewport.png` });
});

test(`${P}: 375 empty state`, async ({ page }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto("/home");
	await expect(page.locator('input[placeholder="City or airport"]').first()).toBeVisible({ timeout: 30_000 });
	await page.waitForTimeout(2000);
	await page.screenshot({ path: `playwright/.artifacts/density-${P}-375-empty.png`, fullPage: true });
});
