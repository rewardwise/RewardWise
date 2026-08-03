/** @format */
// Live verify (SerpAPI quota exhausted -> every fresh route yields the
// cash-unavailable partial-data card):
// 1. RT partial-data card shows BOTH award legs, or the explicit
//    no-return-award line — never an outbound-only box implying whole-trip.
// 2. The next Zoe turn's /api/zoe payload carries the cash-unavailable
//    stance in verdict_context (do NOT recommend points; never invent cash).
import { test, expect } from "@playwright/test";

test("partial-data RT: two-leg booking box + context stance in payload", async ({ page }) => {
	test.setTimeout(420_000);
	let zoeBody: any = null;
	page.on("request", (req) => {
		if (req.url().endsWith("/api/zoe") && req.method() === "POST") {
			try { zoeBody = JSON.parse(req.postData() || "{}"); } catch { /* ignore */ }
		}
	});

	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("Tokyo"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-16");
	await d.nth(1).fill("2027-03-29");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 300_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	console.log("REC:", body?.verdict?.recommendation, "| cash:", body?.cash_price, "| winner:", body?.verdict?.winner?.program, "| return_winner:", body?.verdict?.return_winner?.program ?? null);
	await page.waitForTimeout(6000);

	// ── 1. Card scope ────────────────────────────────────────────────────────
	const card = page.getByTestId("partial-data-card");
	if (!(await card.isVisible().catch(() => false))) {
		console.log("NOT a partial-data verdict (cash came back?) — cannot verify in this state");
		expect(body?.cash_price, "expected cash-unavailable state for this verify").toBeNull();
		return;
	}
	const winnerBox = page.getByTestId("partial-data-winner");
	await expect(winnerBox).toBeVisible();
	const hasReturnRow = await page.getByTestId("partial-data-return").isVisible().catch(() => false);
	const hasNoReturnNote = await page.getByTestId("partial-data-no-return").isVisible().catch(() => false);
	console.log("return row:", hasReturnRow, "| explicit no-return note:", hasNoReturnNote);
	expect(hasReturnRow || hasNoReturnNote, "RT card must show the return leg or say it's missing").toBe(true);
	expect(hasReturnRow && hasNoReturnNote).toBe(false);
	await page.screenshot({ path: "playwright/.artifacts/partial-1-two-leg.png", fullPage: true });

	// ── 2. Context stance rides the next Zoe turn ────────────────────────────
	const zoe = page.getByPlaceholder("Tell Zoe about your trip…");
	await zoe.fill("should I book the points?");
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await zp;
	const ctx = String(zoeBody?.verdict_context ?? "");
	console.log("CTX head:", ctx.slice(0, 220));
	expect(ctx).toContain("Live cash price UNAVAILABLE");
	expect(ctx).toContain("Do NOT recommend booking points");
	expect(ctx).toContain("never invent or estimate a cash price");
	await page.waitForTimeout(3000);
	await page.screenshot({ path: "playwright/.artifacts/partial-2-zoe-turn.png" });
});
