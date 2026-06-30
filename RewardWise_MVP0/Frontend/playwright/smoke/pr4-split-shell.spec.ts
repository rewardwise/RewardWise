/**
 * Production smoke: PR 4 — verdict-route split shell + light theme.
 *
 * Desktop (1440): the verdict route is a 58/42 split — results left, Zoe DOCKED
 * right (not the floating FAB) — with the wallet pill in the left header, plus
 * the PR-3 curated-list contract (1–3 cards, exactly one highlighted, tag
 * matches the recommendation). Coherent under either recommendation snapshot.
 */

import { test, expect } from "@playwright/test";

function isoDaysFromToday(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().split("T")[0];
}

test.describe("PR 4: verdict-route split shell + docked Zoe", () => {
	test("SFO→SIN PE RT ×3 — split shell, docked Zoe (no FAB), wallet pill, curated cards coherent", async ({
		page,
	}) => {
		test.setTimeout(180_000);

		await page.goto("/home");
		const cta = page.getByRole("button", { name: /try a (free )?search( first)?/i }).first();
		if (await cta.isVisible({ timeout: 4000 }).catch(() => false)) await cta.click();

		const inputs = page.getByPlaceholder("City or airport");
		await inputs.first().fill("SFO");
		await inputs.first().press("Enter");
		await inputs.nth(1).fill("SIN");
		await inputs.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.first().fill(isoDaysFromToday(180));
		await dates.nth(1).fill(isoDaysFromToday(194));
		const selects = page.getByRole("combobox");
		await selects.first().selectOption("3");
		await selects.nth(2).selectOption("premium_economy");

		const resp = page.waitForResponse(
			(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 120_000 },
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		const response = await resp;
		expect(response.status()).toBe(200);
		const recommendation = ((await response.json()) as { verdict?: { recommendation?: string } })
			.verdict?.recommendation;
		expect(recommendation).toMatch(/^(use_points|pay_cash)$/);

		// Curated list + exactly one highlight, tag matches recommendation (PR 3 contract).
		const curated = page.locator('[data-testid="curated-options"]');
		await expect(curated).toBeVisible({ timeout: 60_000 });
		const count = await curated.locator('[data-testid="option-card"]').count();
		console.log(`[smoke-pr4] rec=${recommendation} cards=${count}`);
		expect(count).toBeGreaterThanOrEqual(1);
		expect(count).toBeLessThanOrEqual(3);
		await expect(curated.locator('[data-testid="option-card"][data-best="true"]')).toHaveCount(1);
		const tag = (await curated.locator('[data-testid="best-tag"]').first().textContent()) ?? "";
		expect(tag).toContain(recommendation === "use_points" ? "USE POINTS" : "PAY CASH");

		// Shell: Zoe is DOCKED (not the floating FAB) and the wallet pill is present.
		await expect(page.locator('[data-testid="zoe-docked"]')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole("button", { name: "Open Zoe" })).toHaveCount(0); // no FAB
		await expect(page.locator('[data-testid="wallet-pill"]')).toBeVisible();
	});
});
