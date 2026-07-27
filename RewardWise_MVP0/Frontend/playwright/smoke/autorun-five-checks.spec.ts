/** @format */
// Auto-run live verification (operator's five checks), one session.
// Search spend: exactly 2 engine searches (checks 1 + 2).
import { test, expect } from "@playwright/test";

test("five checks: autorun, incremental, nudge, no-trigger, single-fire", async ({ page }) => {
	test.setTimeout(420_000);
	let searches = 0;
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searches += 1;
	});

	// ── Check 4a: page load fires nothing ───────────────────────────────────
	await page.goto("/home");
	await page.waitForTimeout(2500);
	expect(searches, "page load must not search").toBe(0);
	console.log("CHECK4a_PAGE_LOAD ok (0 searches)");

	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	const send = page.getByRole("button", { name: "Send message" });
	const zoe = async (msg: string) => {
		await input.fill(msg);
		const p = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
		await send.click();
		return (await p).json();
	};

	// ── Check 3: incomplete -> nudge, NO search ─────────────────────────────
	const r3 = await zoe("I want to fly to Tokyo");
	console.log("NUDGE_ACK >>>", String(r3?.message).slice(0, 160), "<<<");
	await page.waitForTimeout(2500); // beyond debounce window
	expect(searches, "incomplete fill must not search").toBe(0);
	expect(String(r3?.message)).toContain("I'll run it the second you tell me");
	expect(String(r3?.message)).not.toContain("running it now");
	await page.screenshot({ path: "playwright/.artifacts/ar-3-nudge.png" });
	console.log("CHECK3_NUDGE ok (0 searches, nudge copy)");

	// ── Check 1: full trip -> auto-run + honest ack + verdict, no click ─────
	const r1 = await zoe("Can I go from Denver to Austin September 21 to 25, one traveler?");
	console.log("RUN_ACK >>>", String(r1?.message).slice(0, 160), "<<<");
	expect(String(r1?.message)).toContain("running it now");
	const sp1 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	const s1 = await (await sp1).json();
	console.log("AUTORUN_SEARCH rec=", s1?.verdict?.recommendation, "cash=", s1?.cash_price);
	await page.waitForTimeout(4000);
	expect(searches, "exactly ONE search for the full-trip message").toBe(1);
	await expect(page.getByText("THE VERDICT")).toBeVisible({ timeout: 15_000 });
	await page.screenshot({ path: "playwright/.artifacts/ar-1-autorun.png", fullPage: false });
	console.log("CHECK1_AUTORUN + CHECK5_SINGLE_FIRE ok (1 search, verdict visible, no click)");

	// ── Check 2: incremental date -> re-run, only depart moves ──────────────
	const dates = page.locator('input[type="date"]');
	const r2 = await zoe("what about the 23rd instead?");
	console.log("INCR_ACK >>>", String(r2?.message).slice(0, 120), "<<<");
	const sp2 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await sp2;
	await page.waitForTimeout(3000);
	expect(searches, "exactly one more search for the incremental").toBe(2);
	await expect(dates.nth(0)).toHaveValue("2026-09-23");
	await expect(dates.nth(1)).toHaveValue("2026-09-25");
	await page.screenshot({ path: "playwright/.artifacts/ar-2-incremental.png", fullPage: false });
	console.log("CHECK2_INCREMENTAL ok (re-ran, only depart moved)");

	// ── Check 4b: manual form edit fires nothing ────────────────────────────
	await dates.nth(0).fill("2026-09-22");
	await page.waitForTimeout(2500);
	expect(searches, "manual edit must not search").toBe(2);
	await page.screenshot({ path: "playwright/.artifacts/ar-4-manual-edit.png" });
	console.log("CHECK4b_MANUAL_EDIT ok (still 2 searches)");

	console.log("ASSERTIONS_RAN: all five checks executed");
});
