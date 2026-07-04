/**
 * Production smoke: island entry band on /home (island spec v2, PR 4).
 *
 * Two-tier layout (ratified ⓒ): TIER 1 = island band behind the header + search
 * pill (left) and the Zoe pane (right); TIER 2 = the verdict renders as a LIGHT
 * card, full width below. Wallet pill gets a photo-safe surface (ⓑ:
 * bg-white/80 + border on the backdrop-blur nav).
 *
 * Runs AUTHENTICATED (/home is not public). Test 2 re-verifies the PR #207
 * sign-out hotfix on the new island /home (regression guard).
 */

import { test, expect } from "@playwright/test";
import { getVercelBypassHeader } from "../auth/vercel-bypass";

test.describe("island /home — entry band + photo-safe wallet pill", () => {
	test.beforeEach(async ({ context }) => {
		await context.setExtraHTTPHeaders({ ...getVercelBypassHeader() });
	});

	test("island band renders + white header + search pill + photo-safe wallet pill", async ({
		page,
	}) => {
		await page.goto("/home");

		// TIER 1 island band: full-bleed width, tall band.
		const islandImg = page.locator('img[src*="hero-island"]').first();
		await expect(islandImg).toBeAttached();
		const island = await islandImg.evaluate((el) => {
			const img = el as HTMLImageElement;
			const r = img.getBoundingClientRect();
			return { loaded: img.naturalWidth > 0, w: r.width, h: r.height };
		});
		expect(island.loaded).toBe(true);
		expect(island.w).toBeGreaterThan(page.viewportSize()!.width * 0.9);
		expect(island.h).toBeGreaterThan(400);

		// Header now WHITE on the island (was dark under mtw-light pre-change).
		const h1 = page.getByRole("heading", { name: /let's optimize your wallet/i });
		await expect(h1).toBeVisible();
		expect(await h1.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");

		// Search pill = solid-white card on the island.
		const pill = page.locator('[data-testid="search-pill"]');
		await expect(pill).toBeVisible();
		expect(await pill.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			"rgb(255, 255, 255)",
		);

		// Wallet pill photo-safe surface (bg-white/80).
		const walletPill = page.locator('[data-testid="nav-wallet-pill"]');
		if (await walletPill.count()) {
			expect(await walletPill.first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
				"rgba(255, 255, 255, 0.8)",
			);
		}
	});

	test("sign-out from island /home still redirects to / (PR #207 regression)", async ({ page }) => {
		await page.goto("/home");
		const avatar = page.locator('[data-testid="avatar-menu-button"]');
		await expect(avatar).toBeVisible();
		await avatar.click();
		await page.getByRole("menuitem", { name: /sign out/i }).click();

		await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 15000 });
		const heroH1 = page.locator('[data-testid="hero-h1"]');
		await expect(heroH1).toBeVisible();
		await expect(heroH1).toContainText(/cash or points\?\s*we'?ll tell you/i);
		await expect(page.locator('[data-testid="avatar-menu-button"]')).toHaveCount(0);
	});
});
