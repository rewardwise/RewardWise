/**
 * Production smoke: island hero band + relit /about (island spec v2, PR 3).
 *
 * Pre-fix: dark gradient page (slate-900->cyan-950) + TropicalBackground + dark
 * glass content card. Post-fix: island hero BAND (photo + scrim, white H1) over
 * a mint page, with the founder story relit to a solid-white light card.
 */

import { test, expect } from "@playwright/test";
import { getVercelBypassHeader } from "../auth/vercel-bypass";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("island /about — hero band + relit light content", () => {
	test.beforeEach(async ({ context }) => {
		await context.setExtraHTTPHeaders({ ...getVercelBypassHeader() });
	});

	test("island band renders + white H1 + light story card + Inter", async ({ page }) => {
		await page.goto("/about");

		// Island hero band: full-bleed width, band height (not full viewport).
		const islandImg = page.locator('img[src*="hero-island"]').first();
		await expect(islandImg).toBeAttached();
		const island = await islandImg.evaluate((el) => {
			const img = el as HTMLImageElement;
			const r = img.getBoundingClientRect();
			return { loaded: img.naturalWidth > 0, w: r.width, h: r.height };
		});
		expect(island.loaded).toBe(true);
		expect(island.w).toBeGreaterThan(page.viewportSize()!.width * 0.9);
		expect(island.h).toBeGreaterThan(180);

		// H1 white on the band, Inter.
		const h1 = page.getByRole("heading", { name: /about mytravelwallet/i });
		await expect(h1).toBeVisible();
		const h1Style = await h1.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { color: cs.color, family: cs.fontFamily };
		});
		expect(h1Style.color).toBe("rgb(255, 255, 255)");
		expect(h1Style.family).toMatch(/^Inter/);

		// Founder story relit to a solid-white light card (falsifies the old dark glass).
		const story = page.locator('[data-testid="about-story-card"]');
		await expect(story).toBeVisible();
		expect(await story.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			"rgb(255, 255, 255)",
		);
		await expect(story).toContainText(/Sabby Nagi, Founder/i);
	});
});
