/** @format */
// P0 live verify (2026-07-28 screenshot bugs):
// 1. "SEA to Tokyo Mar 15 coming back Mar 31" fills BOTH dates and runs.
// 2. "try again" re-runs the ENGINE (POST /api/search), never a Zoe turn.
// 3. A conflicting pair (return before depart) HOLDS and asks — no search,
//    no raw framework validation error anywhere in the UI.
// Note: SerpAPI quota may be exhausted (P1) — assertions target extraction,
// search dispatch, holds, and error hygiene, not verdict quality.
import { test, expect } from "@playwright/test";

test("return-phrase fill + retry re-run + conflict hold", async ({ page }) => {
	test.setTimeout(420_000);
	const zoeCalls: string[] = [];
	const searchCalls: string[] = [];
	page.on("request", (req) => {
		if (req.method() !== "POST") return;
		if (req.url().endsWith("/api/zoe")) zoeCalls.push(req.url());
		if (req.url().includes("/api/search")) searchCalls.push(req.url());
	});

	await page.goto("/home");
	const zoe = page.getByPlaceholder("Tell Zoe about your trip…");
	await expect(zoe).toBeVisible({ timeout: 30_000 });

	// ── 1. The incident message fills both dates and runs ───────────────────
	await zoe.fill("SEA to Tokyo Mar 15 coming back Mar 31");
	const sp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await sp;
	const d = page.locator('input[type="date"]');
	await expect(d.nth(0)).toHaveValue("2027-03-15");
	await expect(d.nth(1)).toHaveValue("2027-03-31");
	console.log("STEP1 dates:", await d.nth(0).inputValue(), "→", await d.nth(1).inputValue(), "| searches:", searchCalls.length);
	expect(searchCalls.length).toBe(1);
	await page.waitForTimeout(4000);
	let body = (await page.locator("body").textContent()) ?? "";
	expect(body).not.toMatch(/pydantic|validation error|Value error|Input should be/i);
	await page.screenshot({ path: "playwright/.artifacts/p0ret-1-both-dates.png" });

	// ── 2. "try again" → engine re-run, zero Zoe turns ──────────────────────
	const zoeBefore = zoeCalls.length;
	const sp2 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await zoe.fill("try again");
	await page.getByRole("button", { name: "Send message" }).click();
	await sp2;
	console.log("STEP2 searches:", searchCalls.length, "| zoe calls added:", zoeCalls.length - zoeBefore);
	expect(searchCalls.length).toBe(2);
	expect(zoeCalls.length - zoeBefore, "'try again' must never become a Zoe turn").toBe(0);
	await expect(page.getByText("running that search again", { exact: false })).toBeVisible();
	await page.waitForTimeout(2000);
	await page.screenshot({ path: "playwright/.artifacts/p0ret-2-retry-rerun.png" });

	// ── 3. Conflicting return holds + asks; no search, no raw error ─────────
	const searchesBefore = searchCalls.length;
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await zoe.fill("coming back Mar 1");
	await page.getByRole("button", { name: "Send message" }).click();
	const zres = await (await zp).json();
	console.log("STEP3 ack:", String(zres?.message ?? "").slice(0, 120));
	expect(String(zres?.message ?? "")).toContain("before departure");
	await page.waitForTimeout(3000);
	expect(searchCalls.length, "conflicting pair must not search").toBe(searchesBefore);
	// Manual submit on the conflicted form is also guarded, friendly copy only.
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await page.waitForTimeout(1500);
	expect(searchCalls.length, "manual submit also held").toBe(searchesBefore);
	body = (await page.locator("body").textContent()) ?? "";
	expect(body).toContain("when are you coming back");
	expect(body).not.toMatch(/pydantic|validation error|Value error|Input should be/i);
	await page.screenshot({ path: "playwright/.artifacts/p0ret-3-conflict-hold.png" });
});
