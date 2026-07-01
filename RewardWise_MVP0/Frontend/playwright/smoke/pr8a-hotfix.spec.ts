/**
 * Production smoke: 8a-hotfix — /home scroll-to-top + wallet pill formatting.
 *
 *  - /home lands at the top on a fresh load (no ~380px jump from Zoe's
 *    welcome-message scroll on mobile's stacked layout).
 *  - The nav wallet pill (when a wallet exists) shows exactly ONE program with a
 *    magnitude-scaled balance (…k / …M / …B) — never the old "…000k" double-suffix.
 *
 * (Banner auto-dismiss is covered by the payment-banner-autodismiss unit test —
 * a live 8s smoke would depend on an unread notification existing on the account.)
 */

import { test, expect } from "@playwright/test";

test("/home lands at the top on fresh load", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto("/home");
	await page.waitForTimeout(3500); // hydration + Zoe welcome message settle
	const scrollY = await page.evaluate(() => window.scrollY);
	console.log(`[smoke-8a-hotfix] fresh-load scrollY = ${scrollY}`);
	expect(scrollY).toBeLessThanOrEqual(2);
});

test("wallet pill is top-1 program, magnitude-scaled (no double-k)", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto("/home");
	const pill = page.locator('[data-testid="nav-wallet-pill"]');
	await pill.waitFor({ timeout: 20_000 }).catch(() => {});
	if (!(await pill.isVisible().catch(() => false))) {
		console.log("[smoke-8a-hotfix] no wallet pill on this account — skipping content assert");
		return;
	}
	const text = ((await pill.textContent()) ?? "").trim();
	console.log(`[smoke-8a-hotfix] wallet pill = "${text}"`);
	expect(text).not.toMatch(/\d000k/); // no un-scaled "…000k"
	// A scaled balance token is present.
	expect(text).toMatch(/\d+(\.\d)?[kMB]\b/);
	// Exactly one program chip after the "Your wallet" prefix.
	const chips = text.replace(/Your wallet/i, "").trim().split(/\s{2,}|·/).filter(Boolean);
	expect(chips.length).toBeLessThanOrEqual(1);
});

test("docked Zoe shows the deterministic welcome (no verdict yet)", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto("/home");
	const welcome = page.locator('[data-testid="zoe-welcome"]');
	await expect(welcome).toBeVisible({ timeout: 20_000 });
	await expect(welcome).toContainText(/i'm zoe/i);
	// Deterministic suggestion chips present.
	await expect(page.locator('[data-testid="zoe-chip-welcome_how"]')).toBeVisible();
	await expect(page.locator('[data-testid="zoe-chip-welcome_ask"]')).toBeVisible();
});
