/** @format */
// Part B verification: owner account (mytravelwalletai@gmail.com) — minted
// session (no password), gate passage, wallet pill + 4 seeded cards, and a
// use_points verdict whose ownership panel reasons over the 1M balances.
import { test, expect } from "@playwright/test";
import { mintSessionViaServiceRole } from "../auth/mint-session";

const BASE = "https://www.mytravelwallet.ai";

test("owner: gate passage, wallet, b2 verdict over seeded points", async ({ browser }) => {
	test.setTimeout(360_000);
	const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
	await mintSessionViaServiceRole(context, { email: "mytravelwalletai@gmail.com", baseUrl: BASE } as any);
	const page = await context.newPage();

	// 1. Gate passage + wallet pill (top per-program chip)
	await page.goto(`${BASE}/home`);
	await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
	expect(page.url()).not.toContain("error=private");
	const pill = page.getByTestId("nav-wallet-pill");
	await expect(pill).toBeVisible();
	console.log("PILL >>>", (await pill.textContent())?.trim(), "<<<");
	await expect(pill).toContainText("1M");
	await page.screenshot({ path: "playwright/.artifacts/owner-1-home-pill.png" });

	// 2. All four balances on wallet-setup
	await page.goto(`${BASE}/wallet-setup`);
	await page.waitForTimeout(2500);
	const body = (await page.locator("body").textContent()) ?? "";
	for (const name of ["Chase Ultimate Rewards", "Alaska Mileage Plan", "Delta SkyMiles", "Amex Membership Rewards"]) {
		expect(body, `${name} visible`).toContain(name);
	}
	const balInputs = await page.locator('[data-testid^="wallet-balance-input-"]').all();
	console.log("WALLET_CARDS:", balInputs.length);
	for (const el of balInputs) console.log("   balance:", await el.inputValue());
	expect(balInputs.length).toBe(4);
	await page.screenshot({ path: "playwright/.artifacts/owner-2-wallet.png", fullPage: true });

	// 3. use_points verdict reasoning over the balances (SFO->SIN prem econ —
	//    use_points on this route in prior live runs)
	await page.goto(`${BASE}/home`);
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SFO"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SIN"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2026-12-24");
	await d.nth(1).fill("2027-01-07");
	await page.getByTestId("more-options-toggle").click();
	await page.locator("select").nth(2).selectOption("premium_economy");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const sbody = await (await rp).json();
	console.log("REC", sbody?.verdict?.recommendation, "| ownership:", JSON.stringify(sbody?.verdict?.ownership ?? null).slice(0, 200));
	await page.waitForTimeout(7000);
	const pageText = (await page.locator("body").textContent()) ?? "";
	const b2ish = /you (can|have enough|already have)|covered|enough points/i.test(pageText);
	console.log("B2_LANGUAGE_PRESENT:", b2ish);
	await page.screenshot({ path: "playwright/.artifacts/owner-3-verdict.png", fullPage: false });
	expect(sbody?.verdict?.recommendation, "use_points verdict for the b2 check").toBe("use_points");
	expect(sbody?.verdict?.ownership, "ownership panel computed").toBeTruthy();
	console.log("ASSERTIONS_RAN: gate, pill, 4 cards, use_points + ownership");
	await context.close();
});
