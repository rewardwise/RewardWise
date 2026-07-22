/** @format */
// LIVE VERIFY (post-#253): (1) a typed NEW-trip message produces a Zoe reply
// with NO pricing (real Xpectrum agent behind the flag), (2) confetti fires
// once when the verdict lands. NOTE: no animation-kill CSS in this spec —
// the confetti node must be observable.

import { test, expect } from "@playwright/test";

test("typed new-trip turn is price-free; confetti fires on verdict", async ({ page }) => {
	test.setTimeout(300_000);

	let zoeReqBody: any = null;
	page.on("request", (req) => {
		if (req.url().endsWith("/api/zoe") && req.method() === "POST") {
			try { zoeReqBody = JSON.parse(req.postData() || "{}"); } catch { /* ignore */ }
		}
	});

	await page.goto("/home");

	// ── (1) typed NEW trip ──────────────────────────────────────────────────
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("Can I go from Seattle to San Diego September 3 to 6, one traveler?");
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	const zres = await (await zp).json();
	const reply = String(zres?.message ?? "");
	console.log("FLAG_SENT", zoeReqBody?.is_new_trip);
	console.log("ZOE_REPLY >>>", reply.slice(0, 400), "<<<");
	expect(zoeReqBody?.is_new_trip, "flag must ride the request").toBe(true);
	// No pricing of any kind: points/miles amounts or dollar figures.
	const pricing = reply.match(/\$\s?\d|\d[\d,]{2,}\s*(points|pts|miles)|cents?\s*per\s*point/i);
	expect(pricing, `reply must not price the trip (matched: ${pricing?.[0] ?? "none"})`).toBeNull();
	await page.screenshot({ path: "playwright/.artifacts/newtrip-1-zoe-reply.png" });

	// ── (2) run the search (form was autofilled) and catch confetti ─────────
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	const v = body?.verdict ?? {};
	console.log("VERDICT", v.recommendation, "| winner", v.winner?.program, v.winner?.points, "| return_winner", v.return_winner?.program, v.return_winner?.points);

	// The burst wrapper is h-0 by design (zero bounding box == "hidden" to
	// Playwright) — assert the PIECES, which have real size.
	const piece = page.locator(".mtw-confetti").first();
	await expect(piece, "confetti pieces appear with the verdict").toBeVisible({ timeout: 15_000 });
	const pieceCount = await page.locator(".mtw-confetti").count();
	console.log("CONFETTI_PIECES", pieceCount);
	await page.screenshot({ path: "playwright/.artifacts/newtrip-2-confetti.png" });
	await expect(page.getByTestId("confetti-burst"), "confetti self-removes from the DOM").toHaveCount(0, { timeout: 5_000 });

	// Queued fold-in: return-side zero divergence when data allows
	if (v.recommendation === "use_points" && v.return_winner?.points) {
		const retText = (await page.getByTestId("book-return").textContent().catch(() => "")) || "";
		expect(retText.replace(/,/g, ""), "return card == engine return_winner").toContain(String(v.return_winner.points * (body?.travelers ?? 1)));
		console.log("RETURN_SIDE_ZERO_DIVERGENCE: executed and passed");
	} else {
		console.log("RETURN_SIDE_ZERO_DIVERGENCE: not executable — stays queued");
	}
	console.log("ASSERTIONS_RAN: flag, price-free reply, confetti appear+cleanup");
	await page.screenshot({ path: "playwright/.artifacts/newtrip-3-verdict.png" });
});
