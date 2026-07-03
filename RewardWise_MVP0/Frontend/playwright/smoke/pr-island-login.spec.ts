/**
 * Production smoke: island backdrop + relit /login (island spec v2, PR 1).
 *
 * Pre-fix: dark glassmorphic login — `bg-[#080E1C]` + `beach-hero.png` +
 * navy glass card `bg-[rgba(8,14,28,.78)]` + white text.
 * Post-fix: full-bleed hero-island backdrop + flat rgba(6,20,14,.50) scrim +
 * SOLID-WHITE auth card with dark ink text and light inputs. Falsifies pre-fix:
 * the card computed background was dark navy, not white.
 *
 * Logic is byte-identical to pre-fix (styling only) — sign-in handlers, OAuth,
 * validation, and the authed->/home redirect are unchanged.
 */

import { test, expect } from "@playwright/test";
import { getVercelBypassHeader } from "../auth/vercel-bypass";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("island /login — relit solid-white card on island", () => {
	test.beforeEach(async ({ context }) => {
		await context.setExtraHTTPHeaders({ ...getVercelBypassHeader() });
	});

	test("island backdrop + white card + light form + Inter", async ({ page }) => {
		await page.goto("/login");

		// Island backdrop (next/image with the island asset).
		await expect(page.locator('img[src*="hero-island"]').first()).toBeAttached();

		// Solid-white auth card (falsifies the old dark navy card).
		const card = page.locator('[data-testid="auth-card"]');
		await expect(card).toBeVisible();
		const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(cardBg).toBe("rgb(255, 255, 255)");

		// Heading: dark ink (#161d19), rendered in Inter (global font fix holds here).
		const h1 = page.getByRole("heading", { name: /welcome back/i });
		await expect(h1).toBeVisible();
		const h1Style = await h1.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { color: cs.color, family: cs.fontFamily };
		});
		expect(h1Style.color).toBe("rgb(22, 29, 25)"); // #161d19 mtw-ink-strong
		expect(h1Style.family).toMatch(/^Inter/);

		// Relit form: light inputs (white bg, dark text) + both CTAs.
		const emailInput = page.locator("#email");
		await expect(emailInput).toBeVisible();
		const inputBg = await emailInput.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(inputBg).toBe("rgb(255, 255, 255)");
		await expect(page.locator("#password")).toBeVisible();
		await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
	});
});
