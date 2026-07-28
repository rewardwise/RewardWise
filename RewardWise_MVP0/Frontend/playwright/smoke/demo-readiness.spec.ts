/** @format */
// Part 3 — demo-path verification on live prod (post-#288 merge sha).
// As the OWNER (seeded 4×1M wallet), walk the <1-minute demo at 1440 and 375:
// typed trip → verdict + confetti → points-win with b2 ownership over the
// seeded wallet → cash deep link resolves to prefilled Google Flights.
// Also pins the #288 fixes live: history dates exact (no off-by-one), wallet
// inputs legible (white bg / dark text), no Concierge CTA, invite-only landing.
// All contexts are minted fresh (explicit empty storageState — never inherit
// the project smoke cookies).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mintSessionViaServiceRole } from "../auth/mint-session";

const BASE = "https://www.mytravelwallet.ai";
const ART = "playwright/.artifacts/demo";

async function ownerContext(browser: any, viewport: { width: number; height: number }): Promise<BrowserContext> {
	const context = await browser.newContext({
		storageState: { cookies: [], origins: [] },
		viewport,
	});
	await mintSessionViaServiceRole(context, { email: "mytravelwalletai@gmail.com", baseUrl: BASE } as any);
	return context;
}

test("anon landing 1440+375: invite-only copy live", async ({ browser }) => {
	test.setTimeout(120_000);
	for (const [tag, viewport] of [["1440", { width: 1440, height: 900 }], ["375", { width: 375, height: 812 }]] as const) {
		const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport });
		const page = await ctx.newPage();
		await page.goto(`${BASE}/`);
		await expect(page.getByText("Now private — invitation only")).toBeVisible({ timeout: 20_000 });
		const body = (await page.locator("body").textContent()) ?? "";
		expect(body).toContain("request access at mytravelwalletai@gmail.com");
		expect(body).not.toContain("Free account, verdict in seconds");
		await expect(page.getByRole("button", { name: /Request access/ }).first()).toBeVisible();
		await page.screenshot({ path: `${ART}/${tag}-landing.png` });
		console.log(`LANDING ${tag}: invite-only copy live`);
		await ctx.close();
	}
});

test("owner demo walk 1440: typed trip → verdict+confetti → GF deeplink → b2 points-win → #288 fixes", async ({ browser }) => {
	test.setTimeout(600_000);
	const context = await ownerContext(browser, { width: 1440, height: 900 });
	const page = await context.newPage();

	// ── Beat 1: typed trip into Zoe input ───────────────────────────────────
	await page.goto(`${BASE}/home`);
	const zoe = page.getByPlaceholder("Tell Zoe about your trip…");
	await expect(zoe).toBeVisible({ timeout: 30_000 });
	const pill = page.getByTestId("nav-wallet-pill");
	await expect(pill).toBeVisible();
	await expect(pill, "seeded wallet pill shows 1M").toContainText("1M");
	await zoe.fill("Seattle to Tokyo March 15 to 30, 2 travelers");
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await zp;
	await page.screenshot({ path: `${ART}/1440-1-typed-trip.png` });

	// Read back what autofill put in the form (drives later GF assertions).
	const dateInputs = page.locator('input[type="date"]');
	const dep = await dateInputs.nth(0).inputValue();
	const ret = await dateInputs.nth(1).inputValue();
	console.log("AUTOFILL dates:", dep, "→", ret);
	expect(dep, "autofill produced a departure date").toMatch(/^\d{4}-\d{2}-\d{2}$/);

	// ── Beat 2: search → cash verdict + confetti ────────────────────────────
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body1 = await (await rp).json();
	const v1 = body1?.verdict ?? {};
	console.log("VERDICT1", v1.recommendation, "| cash", body1?.cash_price, "| gf_url:", Boolean(body1?.cash_google_flights_url));

	const piece = page.locator(".mtw-confetti").first();
	await expect(piece, "confetti fires with the verdict").toBeVisible({ timeout: 20_000 });
	console.log("CONFETTI pieces:", await page.locator(".mtw-confetti").count());
	await page.screenshot({ path: `${ART}/1440-2-verdict-confetti.png` });
	await page.waitForTimeout(6000);
	await page.screenshot({ path: `${ART}/1440-3-verdict-full.png`, fullPage: true });

	// ── Beat 3: cash deep link → prefilled Google Flights ───────────────────
	const link = page.locator('a:has-text("Google Flights")').first();
	await expect(link, "GF link renders on the cash card").toBeVisible({ timeout: 15_000 });
	const href = (await link.getAttribute("href")) ?? "";
	console.log("GF HREF:", href.slice(0, 140));
	expect(href).toContain("google.com/travel/flights");
	expect(href).toContain("tfs=");
	const [dest] = await Promise.all([context.waitForEvent("page", { timeout: 30_000 }), link.click()]);
	await dest.waitForLoadState("domcontentloaded");
	await dest.waitForTimeout(6000);
	const destText = (await dest.locator("body").textContent()) ?? "";
	console.log("GF DEST URL:", dest.url().slice(0, 110));
	expect(dest.url(), "landed on Google Flights, not a carrier homepage").toContain("google.com/travel/flights");
	expect(/Seattle|SEA/i.test(destText), "GF prefilled with origin").toBe(true);
	expect(/Tokyo|Narita|Haneda|NRT|HND/i.test(destText), "GF prefilled with destination").toBe(true);
	await dest.screenshot({ path: `${ART}/1440-4-google-flights.png` });
	await dest.close();

	// ── Beat 4: points-win with b2 over the seeded wallet ───────────────────
	await page.goto(`${BASE}/home`);
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SFO"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SIN"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2026-12-24");
	await d.nth(1).fill("2027-01-07");
	await page.getByTestId("more-options-toggle").click();
	await page.locator("select").nth(2).selectOption("premium_economy");
	const rp2 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body2 = await (await rp2).json();
	const v2 = body2?.verdict ?? {};
	console.log("VERDICT2", v2.recommendation, "| winner", v2.winner?.program, v2.winner?.points, "| ownership:", JSON.stringify(v2.ownership ?? null).slice(0, 160));
	expect(v2.recommendation, "points-win route for the demo").toBe("use_points");
	expect(v2.ownership, "b2 ownership panel computed over seeded wallet").toBeTruthy();
	await page.waitForTimeout(7000);
	const ptext = (await page.locator("body").textContent()) ?? "";
	const b2ish = /you (can|have enough|already have)|covered|enough points/i.test(ptext);
	console.log("B2_LANGUAGE_PRESENT:", b2ish);
	expect(b2ish, "b2 'you have the points' language on the card").toBe(true);
	await page.screenshot({ path: `${ART}/1440-5-points-b2.png`, fullPage: true });

	// ── #288 live: history dates exact (searches above just created rows) ───
	await page.goto(`${BASE}/history`);
	await page.waitForTimeout(3500);
	const htext = (await page.locator("body").textContent()) ?? "";
	expect(htext, "SFO→SIN departure renders Dec 24 (not 23)").toContain("Dec 24, 2026");
	expect(htext, "no off-by-one Dec 23 for the Dec 24 search").not.toContain("Dec 23, 2026");
	await page.screenshot({ path: `${ART}/1440-6-history.png`, fullPage: true });

	// ── #288 live: wallet-setup inputs legible ──────────────────────────────
	await page.goto(`${BASE}/wallet-setup`);
	await page.waitForTimeout(2500);
	const input0 = page.locator('[data-testid^="wallet-balance-input-"]').first();
	await expect(input0).toBeVisible({ timeout: 15_000 });
	const styles = await input0.evaluate((el) => {
		const cs = getComputedStyle(el);
		return { bg: cs.backgroundColor, color: cs.color };
	});
	console.log("WALLET INPUT styles:", JSON.stringify(styles));
	expect(styles.bg, "input background is white").toBe("rgb(255, 255, 255)");
	expect(styles.color, "input text is dark").not.toBe("rgb(255, 255, 255)");
	await page.screenshot({ path: `${ART}/1440-7-wallet.png`, fullPage: true });

	// ── #288 live: no Concierge CTA on Profile→Tools ────────────────────────
	await page.goto(`${BASE}/profile`);
	await page.waitForTimeout(2500);
	const proftext = (await page.locator("body").textContent()) ?? "";
	expect(proftext).not.toContain("Concierge");
	expect(proftext).not.toContain("$19");
	await page.screenshot({ path: `${ART}/1440-8-profile.png`, fullPage: true });

	await context.close();
});

test("owner demo walk 375: verdict + b2 + wallet legible", async ({ browser }) => {
	test.setTimeout(420_000);
	const context = await ownerContext(browser, { width: 375, height: 812 });
	const page = await context.newPage();

	await page.goto(`${BASE}/home`);
	await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
	await page.screenshot({ path: `${ART}/375-1-home.png` });

	// Same SFO→SIN params as 1440 — payload cache serves this (zero provider
	// spend) and the same-user verdict cache may serve the verdict.
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SFO"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SIN"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2026-12-24");
	await d.nth(1).fill("2027-01-07");
	await page.getByTestId("more-options-toggle").click();
	await page.locator("select").nth(2).selectOption("premium_economy");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	console.log("375 VERDICT", body?.verdict?.recommendation);
	expect(body?.verdict?.recommendation).toBe("use_points");
	await page.waitForTimeout(7000);
	const ptext = (await page.locator("body").textContent()) ?? "";
	expect(/you (can|have enough|already have)|covered|enough points/i.test(ptext), "b2 language at 375").toBe(true);
	await page.screenshot({ path: `${ART}/375-2-points-b2.png`, fullPage: true });

	await page.goto(`${BASE}/wallet-setup`);
	await page.waitForTimeout(2500);
	const input0 = page.locator('[data-testid^="wallet-balance-input-"]').first();
	await expect(input0).toBeVisible({ timeout: 15_000 });
	const bg = await input0.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(bg).toBe("rgb(255, 255, 255)");
	await page.screenshot({ path: `${ART}/375-3-wallet.png`, fullPage: true });

	await context.close();
});
