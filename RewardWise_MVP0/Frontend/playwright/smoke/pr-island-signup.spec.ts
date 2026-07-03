/**
 * Production smoke: island backdrop + relit /signup (island spec v2, PR 2).
 *
 * Pre-fix: dark glassmorphic signup (bg-[#080E1C] + beach-hero + navy glass card).
 * Post-fix: full-bleed hero-island backdrop (loaded + covers viewport, needs
 * `isolate` on the root) + flat scrim + SOLID-WHITE card, dark ink, light inputs.
 * Shares AuthBackdrop/AuthLoading with /login. Logic byte-identical (styling only).
 */

import { test, expect } from "@playwright/test";
import { getVercelBypassHeader } from "../auth/vercel-bypass";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("island /signup — relit solid-white card on island", () => {
	test.beforeEach(async ({ context }) => {
		await context.setExtraHTTPHeaders({ ...getVercelBypassHeader() });
	});

	test("island backdrop renders + white card + light form + Inter", async ({ page }) => {
		await page.goto("/signup");

		const islandImg = page.locator('img[src*="hero-island"]').first();
		await expect(islandImg).toBeAttached();
		const island = await islandImg.evaluate((el) => {
			const img = el as HTMLImageElement;
			const r = img.getBoundingClientRect();
			return { loaded: img.naturalWidth > 0, w: r.width, h: r.height };
		});
		expect(island.loaded).toBe(true);
		expect(island.w).toBeGreaterThan(page.viewportSize()!.width * 0.9);
		expect(island.h).toBeGreaterThan(page.viewportSize()!.height * 0.9);

		const card = page.locator('[data-testid="auth-card"]');
		await expect(card).toBeVisible();
		expect(await card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			"rgb(255, 255, 255)",
		);

		const h1 = page.getByRole("heading", { name: /create your account/i });
		await expect(h1).toBeVisible();
		const h1Style = await h1.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { color: cs.color, family: cs.fontFamily };
		});
		expect(h1Style.color).toBe("rgb(22, 29, 25)"); // #161d19
		expect(h1Style.family).toMatch(/^Inter/);

		const emailInput = page.locator("#email");
		await expect(emailInput).toBeVisible();
		expect(await emailInput.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			"rgb(255, 255, 255)",
		);
		await expect(page.locator("#password")).toBeVisible();
		await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
	});
});
