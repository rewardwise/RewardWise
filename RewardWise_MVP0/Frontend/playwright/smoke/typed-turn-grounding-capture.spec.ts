/** @format */
// Regression capture (LIVE PROD): does a TYPED Zoe turn carry verdict_context
// + wallet, and does the reply contradict the on-screen verdict?
// Also folds in the queued RT-with-return-space zero-divergence check.

import { test, expect } from "@playwright/test";

test("typed turn: capture /api/zoe request body + reply vs verdict", async ({ page }) => {
	test.setTimeout(300_000);

	const captured: Array<{ url: string; body: any }> = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/zoe") && req.method() === "POST") {
			try { captured.push({ url: req.url(), body: JSON.parse(req.postData() || "{}") }); } catch { /* ignore */ }
		}
	});

	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

	// RT route chosen for likely return award space (fold-in of queued check)
	const d = page.locator('input[type="date"]');
	await d.nth(0).fill("2026-09-15");
	await d.nth(1).fill("2026-09-22");
	const a = page.locator('input[placeholder="City or airport"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("LAX"); await a.nth(1).press("Enter");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	const v = body?.verdict ?? {};
	console.log("VERDICT", v.recommendation, "| cash", v.cash_price, "| scope", v.metrics?.scope,
		"| winner", v.winner?.program, v.winner?.points, "| return_winner", v.return_winner?.program, v.return_winner?.points);
	await page.waitForTimeout(6000);
	await page.screenshot({ path: "playwright/.artifacts/grounding-1-verdict.png", fullPage: false });

	// Queued fold-in: return-side zero divergence when the data allows it
	if (v.recommendation === "use_points" && v.return_winner?.points) {
		const retText = (await page.getByTestId("book-return").textContent().catch(() => "")) || "";
		expect(retText.replace(/,/g, ""), "return card == engine return_winner").toContain(
			String(v.return_winner.points * (body?.travelers ?? 1)));
		console.log("RETURN_SIDE_ZERO_DIVERGENCE: executed and passed");
	} else {
		console.log("RETURN_SIDE_ZERO_DIVERGENCE: not executable (rec=", v.recommendation, ", return_winner=", v.return_winner?.points, ") — stays queued");
	}

	// ── TYPED turn while the verdict is on screen ───────────────────────────
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("Is there a cheaper way to book this with points?");
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	const zres = await (await zp).json();
	await page.waitForTimeout(1500);
	await page.screenshot({ path: "playwright/.artifacts/grounding-2-typed-reply.png", fullPage: false });

	const typed = captured.filter((c) => c.url.endsWith("/api/zoe")).pop();
	const ctx = typed?.body?.verdict_context;
	const wallet = typed?.body?.wallet;
	console.log("TYPED_BODY_KEYS", Object.keys(typed?.body ?? {}).join(","));
	console.log("VERDICT_CONTEXT_PRESENT", Boolean(ctx), "| length", ctx ? String(ctx).length : 0);
	console.log("VERDICT_CONTEXT_RAW >>>", String(ctx).slice(0, 600), "<<<");
	console.log("WALLET_PRESENT", Array.isArray(wallet), "| entries", Array.isArray(wallet) ? wallet.length : 0, JSON.stringify(wallet ?? null));
	console.log("ZOE_REPLY >>>", String(zres?.message ?? "").slice(0, 800), "<<<");

	console.log("ASSERTIONS_RAN: capture complete");
	expect(typed, "a typed /api/zoe request was captured").toBeTruthy();
});
