/**
 * Production smoke: 8b-profile — Profile rebuild + Wallet CRUD + Preferences.
 *
 *  - 4 sidebar sections route (Account / Billing / Wallet / Preferences).
 *  - Pro-access single-source: the "Pro access" label lives in Billing, NOT Account.
 *  - Wallet CRUD full cycle (add → edit → delete-modal) emits the three analytics
 *    events with real payloads; the added row is cleaned up by the delete.
 *  - Preferences save emits preferences_updated. Prints all captured JSON.
 */

import { test, expect, type Request } from "@playwright/test";

const ADD_CARD_VALUE = "united_mileageplus"; // AVAILABLE_CARDS id
const ADD_CARD_TEXT = "United MileagePlus";

test.describe("8b-profile (prod)", () => {
	test("4 sections route; Pro-access is Billing-only (single source)", async ({ page }) => {
		test.setTimeout(90_000);
		await page.goto("/profile");
		await page.locator('[data-testid="profile-nav-account"]').waitFor({ timeout: 30_000 });

		// Account must NOT contain the "Pro access" status label.
		await page.locator('[data-testid="profile-nav-account"]').click();
		await expect(page.getByText("Tools")).toBeVisible();
		await expect(page.getByText(/Pro access/i)).toHaveCount(0);

		// Billing is the canonical home of the status.
		await page.locator('[data-testid="profile-nav-billing"]').click();
		await expect(page.locator('[data-testid="billing-plan-status"]')).toBeVisible();

		await page.locator('[data-testid="profile-nav-wallet"]').click();
		await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible();

		await page.locator('[data-testid="profile-nav-preferences"]').click();
		await expect(page.locator('[data-testid="preferences-form"]')).toBeVisible();
	});

	test("Wallet CRUD cycle emits added / edited / removed analytics", async ({ page }) => {
		test.setTimeout(150_000);
		const events: Record<string, unknown>[] = [];
		page.on("request", (r: Request) => {
			if (r.url().includes("/api/analytics") && r.method() === "POST") {
				try {
					const b = r.postDataJSON();
					if (String(b?.event_name).startsWith("wallet_program_")) events.push(b);
				} catch {
					/* ignore */
				}
			}
		});

		await page.goto("/profile");
		await page.locator('[data-testid="profile-nav-wallet"]').click();
		await page.locator('[data-testid="wallet-add-open"], [data-testid="wallet-add-open-empty"]').first().click();

		// ADD
		await page.locator('[data-testid="wallet-add-select"]').selectOption(ADD_CARD_VALUE);
		await page.locator('[data-testid="wallet-add-balance"]').fill("120000");
		await page.locator('[data-testid="wallet-add-submit"]').click();
		const row = page.locator('[data-testid^="wallet-row-"]').filter({ hasText: ADD_CARD_TEXT }).first();
		await expect(row).toBeVisible({ timeout: 15_000 });

		// EDIT
		await row.locator('[data-testid^="wallet-edit-"]').first().click();
		const editInput = row.locator('[data-testid^="wallet-edit-input-"]');
		await editInput.fill("130000");
		await row.locator('[data-testid^="wallet-edit-save-"]').click();
		await expect(row.getByText("130k")).toBeVisible({ timeout: 10_000 });

		// DELETE (modal-gated)
		await row.locator('[data-testid^="wallet-delete-"]').click();
		await expect(page.locator('[data-testid="wallet-delete-modal"]')).toBeVisible();
		await page.locator('[data-testid="wallet-delete-confirm"]').click();
		await expect(row).toHaveCount(0, { timeout: 15_000 });

		await page.waitForTimeout(500);
		for (const e of events) {
			const { event_name, event_type, metadata } = e as Record<string, unknown>;
			console.log("[smoke-8b-profile] " + JSON.stringify({ event_name, event_type, metadata }));
		}
		expect(events.some((e) => e.event_name === "wallet_program_added")).toBe(true);
		expect(events.some((e) => e.event_name === "wallet_program_edited")).toBe(true);
		expect(events.some((e) => e.event_name === "wallet_program_removed")).toBe(true);
	});

	test("Preferences save emits preferences_updated", async ({ page }) => {
		test.setTimeout(90_000);
		const events: Record<string, unknown>[] = [];
		page.on("request", (r: Request) => {
			if (r.url().includes("/api/analytics") && r.method() === "POST") {
				try {
					const b = r.postDataJSON();
					if (b?.event_name === "preferences_updated") events.push(b);
				} catch {
					/* ignore */
				}
			}
		});

		await page.goto("/profile");
		await page.locator('[data-testid="profile-nav-preferences"]').click();
		const cabin = page.locator('[data-testid="pref-cabin"]');
		await expect(cabin).toBeVisible();
		// Flip cabin to a non-current value, then save.
		const current = await cabin.inputValue();
		await cabin.selectOption(current === "business" ? "economy" : "business");
		await page.locator('[data-testid="pref-save"]').click();
		await expect(page.locator('[data-testid="pref-saved"]')).toBeVisible({ timeout: 10_000 });

		await page.waitForTimeout(500);
		for (const e of events) {
			const { event_name, metadata } = e as Record<string, unknown>;
			console.log("[smoke-8b-profile] " + JSON.stringify({ event_name, metadata }));
		}
		expect(events.some((e) => e.event_name === "preferences_updated")).toBe(true);
	});
});
