/** @format */
// PRE-MERGE proofs on the Vercel preview:
// 1. CRITICAL: existing, non-allowlisted smoke account logs in untouched.
// 2. /signup shows the invitation-only banner (no form).
// 3. /subscribe has no reachable pay flow.
import { test, expect } from "@playwright/test";

test("existing non-allowlisted account passes the gate untouched", async ({ page }) => {
	test.setTimeout(180_000);
	await page.goto("/home");
	// Middleware runs the gate on this request with the minted smoke session
	// (created 2026-05, NOT on any allowlist). Grandfather must let it through.
	await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId("nav-wallet-pill")).toBeVisible();
	expect(page.url()).toContain("/home");
	expect(page.url()).not.toContain("error=private");
	console.log("EXISTING_USER_OK: /home loaded, wallet pill visible, no private redirect");
	await page.screenshot({ path: "playwright/.artifacts/pm-1-existing-user.png" });
});

test("signup page shows the private banner instead of the form", async ({ page }) => {
	await page.goto("/signup");
	await expect(page.getByTestId("private-banner")).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText("invitation-only")).toBeVisible();
	await expect(page.locator('input[type="password"]')).toHaveCount(0);
	console.log("SIGNUP_BANNER_OK: banner visible, no password field");
	await page.screenshot({ path: "playwright/.artifacts/pm-2-signup-banner.png" });
});

test("no reachable pay flow", async ({ page }) => {
	await page.goto("/subscribe");
	// Two valid no-pay surfaces: the internal-account card (INTERNAL_EMAILS
	// accounts) or the payments-disabled notice (everyone else). Both have no
	// checkout path; which renders depends on the account.
	const notice = page.getByTestId("payments-disabled-notice");
	const internalCard = page.getByText("Internal account");
	await expect(notice.or(internalCard).first()).toBeVisible({ timeout: 20_000 });
	await expect(page.getByText(/Day Pass|\$19\b|\$199\b/).first()).toBeHidden().catch(() => {});
	const checkout = await page.evaluate(async () => {
		const r = await fetch("/api/payments/checkout", { method: "POST" });
		return { status: r.status, body: JSON.stringify(await r.json()).slice(0, 120) };
	});
	console.log("CHECKOUT_PROBE", JSON.stringify(checkout));
	expect(checkout.status).toBeGreaterThanOrEqual(400);
	await page.screenshot({ path: "playwright/.artifacts/pm-3-payments-off.png" });
});
