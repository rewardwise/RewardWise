/** @format */
// Demo snapshot mode (?demo=1) live verify:
// 1. The exact demo search renders the frozen $1,920 / Flying Blue 114,500 /
//    b2 card with ZERO network search calls (asserted at the network layer —
//    stronger than log absence).
// 2. Without the flag, the same search DOES call the backend (real path
//    unaffected).
import { test, expect } from "@playwright/test";

async function fillDemoSearch(page: any) {
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("Tokyo"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SEA"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-23");
	await page.getByTestId("more-options-toggle").click();
	await page.getByRole("button", { name: /One Way/i }).click();
	await page.locator("select").nth(2).selectOption("business");
}

test("?demo=1 renders the frozen card with zero search calls", async ({ page }) => {
	test.setTimeout(240_000);
	const searches: string[] = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searches.push(req.url());
	});
	await page.goto("/home?demo=1");
	await fillDemoSearch(page);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await expect(page.getByText("Use points", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
	await page.waitForTimeout(4000);
	const text = (await page.locator("body").textContent()) ?? "";
	expect(text).toContain("114,500");
	expect(text).toContain("$1,920");
	expect(text).toContain("You can book this");
	expect(text).toContain("Flying Blue");
	expect(/one way/i.test(text)).toBe(true);
	expect(searches.length, "ZERO search calls in demo mode").toBe(0);
	console.log("DEMO: frozen card rendered, search calls =", searches.length);
	await page.screenshot({ path: "playwright/.artifacts/demo-snapshot-1440.png", fullPage: true });
});

test("without the flag the same search hits the backend", async ({ page }) => {
	test.setTimeout(300_000);
	const searches: string[] = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searches.push(req.url());
	});
	await page.goto("/home");
	await fillDemoSearch(page);
	const rp = page.waitForResponse((r: any) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await rp;
	expect(searches.length, "real path unaffected").toBe(1);
	console.log("REAL PATH: search calls =", searches.length);
});

test("?demo=1 SEA→SFO round trip renders the frozen $262 card, zero calls", async ({ page }) => {
	test.setTimeout(240_000);
	const searches: string[] = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searches.push(req.url());
	});
	await page.goto("/home?demo=1");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SFO"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-15");
	await d.nth(1).fill("2027-03-31");
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await expect(page.getByText("Use points", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
	await page.waitForTimeout(4000);
	const text = (await page.locator("body").textContent()) ?? "";
	expect(text).toContain("10,000");
	expect(text).toContain("$262");
	expect(text).not.toContain("$267");
	expect(text).toContain("You can book this");
	expect(text).toContain("1,000,000");
	expect(searches.length, "ZERO search calls in demo mode").toBe(0);
	console.log("DEMO SEA-SFO: frozen card rendered, search calls =", searches.length);
	await page.screenshot({ path: "playwright/.artifacts/demo-snapshot-seasfo-1440.png", fullPage: true });
});
