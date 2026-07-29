/** @format */
// Business points-WIN showcase: Tokyo→SEA one-way business, Mar 23 2027 —
// the scout's use_points hit (Flying Blue 114,500 + $150 vs $1,920 cash).
// Owner session, 1440; served from the payload cache warmed by the probe.
import { test, expect } from "@playwright/test";
import { mintSessionViaServiceRole } from "../auth/mint-session";

test("Tokyo→SEA Mar 23 business: use_points + b2 render (owner)", async ({ browser }) => {
	test.setTimeout(300_000);
	const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
	await mintSessionViaServiceRole(context, { email: "mytravelwalletai@gmail.com", baseUrl: "https://www.mytravelwallet.ai" } as Parameters<typeof mintSessionViaServiceRole>[1]);
	const page = await context.newPage();
	await page.goto("https://www.mytravelwallet.ai/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("Tokyo"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SEA"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-23");
	await page.getByTestId("more-options-toggle").click();
	await page.getByRole("button", { name: /One Way/i }).click();
	await page.locator("select").nth(2).selectOption("business");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	const v = body?.verdict ?? {};
	console.log("REC:", v.recommendation, "| winner:", v.winner?.program, v.winner?.points, "| cash:", body?.cash_price, "| savings:", v.metrics?.estimated_savings, "| ownership:", JSON.stringify(v.ownership ?? null).slice(0, 140));
	expect(v.recommendation).toBe("use_points");
	await page.waitForTimeout(7000);
	const text = (await page.locator("body").textContent()) ?? "";
	expect(/you (can|have enough|already have)|covered|enough points/i.test(text), "b2 language").toBe(true);
	await page.screenshot({ path: "playwright/.artifacts/biz-win-1440.png", fullPage: true });
});
