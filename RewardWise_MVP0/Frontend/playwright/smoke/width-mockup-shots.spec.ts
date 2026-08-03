/** @format */
// Part-3 mockups (NOT shipped): inject a wider content max-width on live prod
// and screenshot, so the operator can judge the proposal visually.
// Proposal: max-w-6xl (1152px) -> 1280px at >=1280 viewports, 1400px at >=1536.
import { test, expect } from "@playwright/test";

const CASES = [
	{ w: 1440, mockMax: "1280px" },
	{ w: 1680, mockMax: "1400px" },
];

async function widen(page: any, maxWidth: string) {
	await page.evaluate((mw: string) => {
		const main = document.querySelector("section.relative.isolate main") as HTMLElement | null;
		if (main) main.style.maxWidth = mw;
	}, maxWidth);
	await page.waitForTimeout(500);
}

for (const c of CASES) {
	test(`mockup ${c.w}: empty state`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: c.w, height: 900 });
		await page.goto("/home");
		await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
		await page.waitForTimeout(1500);
		await page.screenshot({ path: `playwright/.artifacts/width-before-${c.w}-empty.png` });
		await widen(page, c.mockMax);
		await page.screenshot({ path: `playwright/.artifacts/width-mock-${c.w}-empty.png` });
	});

	test(`mockup ${c.w}: verdict state (demo)`, async ({ page }) => {
		test.setTimeout(180_000);
		await page.setViewportSize({ width: c.w, height: 900 });
		await page.goto("/home?demo=1");
		const a = page.locator('input[placeholder="City or airport"]');
		const d = page.locator('input[type="date"]');
		await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
		await a.nth(1).fill("SFO"); await a.nth(1).press("Enter");
		await d.nth(0).fill("2027-03-15");
		await d.nth(1).fill("2027-03-31");
		await page.getByRole("button", { name: /Search Flights/ }).click();
		await expect(page.getByText("Use points", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
		await page.waitForTimeout(2500);
		await page.screenshot({ path: `playwright/.artifacts/width-before-${c.w}-verdict.png` });
		await widen(page, c.mockMax);
		await page.screenshot({ path: `playwright/.artifacts/width-mock-${c.w}-verdict.png` });
	});
}
