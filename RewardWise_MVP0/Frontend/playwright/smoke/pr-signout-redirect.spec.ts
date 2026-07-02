/**
 * Production smoke: sign-out redirect (P0 hotfix).
 *
 * Pre-fix: TopNav's Sign out called `void signOut()` with no navigation. It
 * cleared the Supabase session (wallet pill vanished) but the /home client
 * stayed mounted and middleware never re-ran, so the user was stuck on a
 * half-rendered /home. Falsifies pre-fix: the post-signout URL stayed /home
 * and hero-h1 never appeared.
 *
 * Post-fix: the handler awaits signOut() then router.replace("/") +
 * router.refresh(), landing the user on the guest landing (island hero).
 *
 * Runs in the AUTHENTICATED project (globalSetup storageState) — needs a real
 * session, so it executes in the auth harness / CI, not headless-guest runs.
 */

import { test, expect } from "@playwright/test";
import { getVercelBypassHeader } from "../auth/vercel-bypass";

test.describe("sign-out returns the user to the guest landing", () => {
	test.beforeEach(async ({ context }) => {
		await context.setExtraHTTPHeaders({ ...getVercelBypassHeader() });
	});

	test("signed-in → avatar → Sign out → lands on / with the island hero", async ({ page }) => {
		await page.goto("/home");

		// Authenticated surface: the avatar menu is present.
		const avatar = page.locator('[data-testid="avatar-menu-button"]');
		await expect(avatar).toBeVisible();
		await avatar.click();
		await expect(page.locator('[data-testid="avatar-menu"]')).toBeVisible();

		await page.getByRole("menuitem", { name: /sign out/i }).click();

		// The fix navigates to the public landing and refreshes; the guest hero
		// must render and the URL must leave /home.
		await expect(page).toHaveURL(/\/(\?.*)?$/, { timeout: 15000 });
		const h1 = page.locator('[data-testid="hero-h1"]');
		await expect(h1).toBeVisible();
		await expect(h1).toContainText(/cash or points\?\s*we'?ll tell you/i);

		// The logged-in nav is gone (no avatar menu on the guest landing).
		await expect(page.locator('[data-testid="avatar-menu-button"]')).toHaveCount(0);
	});
});
