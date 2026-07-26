import { test } from "@playwright/test";
import { writeFileSync } from "fs";
test("repro points-path card", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
	const d = page.locator('input[type="date"]');
	await d.nth(0).fill("2026-11-25");
	await d.nth(1).fill("2026-11-29");
	const a = page.locator('input[placeholder="City or airport"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SFO"); await a.nth(1).press("Enter");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	writeFileSync("playwright/.artifacts/points-path.json", JSON.stringify(body, null, 2));
	console.log("REC", body?.verdict?.recommendation, "CASH", body?.cash_price, "WINNER", JSON.stringify(body?.verdict?.winner));
	console.log("AWARD0_TRIPS", JSON.stringify((body?.award_options?.[0]?.trips ?? []).slice(0,1)).slice(0, 300));
	await page.waitForTimeout(8000);
	const m = await page.evaluate(() => {
		const res = document.querySelector('[data-testid="home-results"]')?.getBoundingClientRect();
		const zoe = document.querySelector('[data-testid="zoe-docked"]')?.parentElement?.getBoundingClientRect();
		return { card: res ? Math.round(res.height) : null, zoe: zoe ? Math.round(zoe.height) : null };
	});
	console.log("HEIGHTS_BEFORE", JSON.stringify(m));
	await page.screenshot({ path: "playwright/.artifacts/points-path-before.png", fullPage: true });
});
