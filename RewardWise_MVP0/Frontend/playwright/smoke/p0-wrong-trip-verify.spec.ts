/** @format */
// P0 live verification: (1) the incident message now fills Tokyo AND runs a
// Tokyo search; (2) a garbled city HOLDS and asks — never searches the old
// destination. Spends 1 engine search (case 1).
import { test, expect } from "@playwright/test";

test("incident message: Tokyo fills and the search runs for Tokyo", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	// Recreate the incident's stale form state: SEA -> SFO, Aug dates
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SFO"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2026-08-19");
	await d.nth(1).fill("2026-08-28");

	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	const sp = page.waitForRequest((r) => r.url().includes("/api/search") && r.method() === "POST", { timeout: 120_000 });
	await input.fill("How about Seattle to Tokyo next year, March 15 to 31st, round trip, one travel?");
	await page.getByRole("button", { name: "Send message" }).click();
	const searchReq = await sp;
	const url = searchReq.url();
	console.log("SEARCH_URL", url.slice(url.indexOf("?")));
	expect(url).toContain("destination=NRT%2CHND");
	expect(url).not.toContain("destination=SFO");
	await expect(a.nth(1)).toHaveValue(/TYO|NRT/i);
	await expect(d.nth(0)).toHaveValue("2027-03-15");
	console.log("P0_CASE1 ok: Tokyo filled, search ran for NRT,HND");
	await page.waitForTimeout(8000);
	await page.screenshot({ path: "playwright/.artifacts/p0-1-tokyo-runs.png" });
});

test("garbled city: HOLDS, asks, and never searches the stale destination", async ({ page }) => {
	test.setTimeout(180_000);
	let searches = 0;
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searches += 1;
	});
	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SFO"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2026-08-19");
	await d.nth(1).fill("2026-08-28");

	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await input.fill("How about Seattle to Tokyoo next year, March 15 to 31st?");
	await page.getByRole("button", { name: "Send message" }).click();
	const reply = String((await (await zp).json())?.message ?? "");
	console.log("ASK_REPLY >>>", reply, "<<<");
	await page.waitForTimeout(3500); // beyond the autorun debounce
	expect(searches, "NO search may fire on an unresolved place").toBe(0);
	expect(reply).toContain("didn't catch that city");
	await expect(a.nth(1)).toHaveValue(/SFO/i); // stale value untouched, unsearched
	console.log("P0_CASE2 ok: held, asked, zero searches");
	await page.screenshot({ path: "playwright/.artifacts/p0-2-garbled-holds.png" });
});
