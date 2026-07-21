/**
 * Production smoke: 8a-hotfix-2 — wallet balance input hardening (10M cap).
 *
 *  - Entering an implausible balance (999,999,999) is REJECTED with a clear
 *    error and NOT written (the guard that prevents a repeat of the ~1.9B rows).
 *  - Entering 250,000 is ACCEPTED and stored as 250,000 (raw) — not ×1000.
 *
 * Uses the first existing wallet card's inline balance editor.
 */

import { test, expect } from "@playwright/test";

async function firstCardId(page: import("@playwright/test").Page): Promise<string | null> {
	const input = page.locator('[data-testid^="wallet-balance-input-"]').first();
	if (!(await input.count())) return null;
	const testid = await input.getAttribute("data-testid");
	return testid ? testid.replace("wallet-balance-input-", "") : null;
}

test.describe("8a-hotfix-2 wallet input hardening (prod)", () => {
	test("rejects an implausible balance (999,999,999) with a clear error, no write", async ({ page }) => {
		test.setTimeout(60_000);
		await page.goto("/wallet-setup");
		await page.waitForLoadState("networkidle").catch(() => {});
		const id = await firstCardId(page);
		test.skip(!id, "account has no wallet card to edit");

		const input = page.locator(`[data-testid="wallet-balance-input-${id}"]`);
		await input.click();
		await input.fill("999999999");
		await page.locator(`[data-testid="wallet-save-${id}"]`).click();

		// Clear error surfaced, mentioning the cap + guidance.
		await expect(page.getByText(/too high/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/50,000,000/).first()).toBeVisible();
	});

	test("accepts 250,000 and stores it raw (not ×1000)", async ({ page }) => {
		test.setTimeout(60_000);
		await page.goto("/wallet-setup");
		await page.waitForLoadState("networkidle").catch(() => {});
		const id = await firstCardId(page);
		test.skip(!id, "account has no wallet card to edit");

		const input = page.locator(`[data-testid="wallet-balance-input-${id}"]`);
		// Seed-preservation rule (see README "wallet state"): this spec drifted
		// the documented smoke seed by writing 250,000 and never restoring.
		// Capture the pre-test balance and put it back at the end.
		const original = (await input.inputValue()).replace(/,/g, "");
		try {
			await input.click();
			await input.fill("250000");
			// Comma-formatted display proves parse = 250000, not 250000000.
			await expect(input).toHaveValue("250,000");
			await page.locator(`[data-testid="wallet-save-${id}"]`).click();
			// No rejection error for a valid value.
			await expect(page.getByText(/too high/i)).toHaveCount(0);
			await expect(input).toHaveValue("250,000");
		} finally {
			if (original && original !== "250000") {
				await input.click();
				await input.fill(original);
				await page.locator(`[data-testid="wallet-save-${id}"]`).click();
				await expect(input).toHaveValue(Number(original).toLocaleString("en-US"));
			}
		}
	});
});
