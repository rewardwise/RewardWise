/** @format */
// #2 close-out (LIVE PROD): zero divergence between headline figures and
// How-to-book figures — the card's booking picks must BE the engine's
// winner/return_winner, and the trade line must sum exactly those picks.

import { test, expect } from "@playwright/test";

test("zero divergence: card picks == engine picks, trade line sums them", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
	// Route: SEA->SFO Thanksgiving — use_points in 8/8 stored verdicts and a
	// corridor with reliable Alaska award space BOTH ways, picked deliberately
	// (operator call 2026-07-22) so the return-side assertion finally executes.
	const d = page.locator('input[type="date"]');
	await d.nth(0).fill("2026-11-25");
	await d.nth(1).fill("2026-11-29");
	const a = page.locator('input[placeholder="City or airport"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SFO"); await a.nth(1).press("Enter");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	const v = body?.verdict ?? {};
	console.log("REC", v.recommendation, "SCOPE", v.metrics?.scope);
	console.log("ENGINE_WINNER", v.winner?.program, v.winner?.points, "ENGINE_RETURN", v.return_winner?.program, v.return_winner?.points);
	await page.waitForTimeout(7000);

	// Old-basis vs new-basis return selection (directional check, no extra
	// searches): (a) costed the fewest-points any-program return; (c) costs the
	// wallet-fit return_winner. When they differ the wallet-fit pick has more
	// points -> lower blended cpp -> biased toward pay_cash (fiduciary-safe).
	const returns = (body?.return_award_options ?? []).filter((r: any) => r?.points);
	if (returns.length > 0) {
		const oldPick = returns.reduce((a: any, b: any) => (a.points <= b.points ? a : b));
		console.log("OLD_BASIS_RETURN", oldPick?.program, oldPick?.points, "NEW_BASIS_RETURN", v.return_winner?.program, v.return_winner?.points);
		if (v.return_winner?.points != null && oldPick?.points != null) {
			console.log("DIRECTION", v.return_winner.points >= oldPick.points ? "more-or-equal points -> pay_cash-biased (as predicted)" : "FEWER points — CONTRADICTS prediction, flag");
		}
	} else {
		console.log("OLD_BASIS_RETURN none (no return awards)");
	}

	// A non-points verdict means the divergence assertions CANNOT run — that
	// must be a loud failure, never a silent green.
	expect(v.recommendation, "route must produce use_points for this check").toBe("use_points");

	// Card booking picks must equal engine picks
	const outText = (await page.getByTestId("book-outbound").textContent().catch(() => "")) || "";
	console.log("CARD_OUTBOUND", outText.slice(0, 120));
	const enginePts = (v.winner?.points ?? 0) * (body?.travelers ?? 1);
	expect(outText.replace(/,/g, ""), "outbound points must match engine winner").toContain(String(enginePts));
	if (v.return_winner?.points) {
		const retText = (await page.getByTestId("book-return").textContent().catch(() => "")) || "";
		console.log("CARD_RETURN", retText.slice(0, 120));
		expect(retText.replace(/,/g, ""), "return points must match engine return_winner").toContain(String(v.return_winner.points * (body?.travelers ?? 1)));
	}
	// Trade line sums exactly the displayed picks
	const trade = (await page.getByTestId("verdict-honesty-line").textContent().catch(() => "")) || "";
	console.log("TRADE_LINE", trade);
	const total = enginePts + ((v.return_winner?.points ?? 0) * (body?.travelers ?? 1));
	expect(trade.replace(/,/g, ""), "trade line must sum the engine picks").toContain(String(total));
	console.log("ASSERTIONS_RAN: outbound-match, return-match (if present), trade-sum — all executed");
	await page.screenshot({ path: "playwright/.artifacts/zero-divergence.png", fullPage: false });
});
