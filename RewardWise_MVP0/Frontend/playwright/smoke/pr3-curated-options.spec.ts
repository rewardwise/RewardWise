/**
 * Production smoke: PR 3 — curated 3-option results list.
 *
 * The redesign replaces the results lead with up to 3 OptionCards driven by the
 * SAME deterministic selection VerdictCard already computes. Contract (holds
 * under EITHER recommendation snapshot — award availability is volatile):
 *   1. Authed /api/search returns 200 + a concrete recommendation.
 *   2. The curated list renders.
 *   3. 1–3 option cards (capped at 3), with EXACTLY ONE highlighted.
 *   4. The highlight tag matches the recommendation: "USE POINTS" for use_points,
 *      "PAY CASH" for pay_cash.
 * (We don't hard-assert "exactly 3" — that depends on live availability; the
 * load-bearing contract is one-highlighted-matching-recommendation, mirroring
 * pr-verdict-redesign's coherence philosophy.)
 *
 * Auth-path routing mirrors pr-verdict-redesign.spec.ts (/home → /api/search).
 */

import { test, expect } from "@playwright/test";

const DEPART_DAYS = 180;
const RETURN_DAYS = 194;

function isoDaysFromToday(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().split("T")[0];
}

test.describe("PR 3: curated 3-option list is coherent on authed /api/search", () => {
	test("SFO→SIN PE round-trip ×3 — 1–3 cards, exactly one highlighted, tag matches recommendation", async ({
		page,
	}) => {
		test.setTimeout(180_000);

		await page.goto("/home");
		const tryASearchCta = page
			.getByRole("button", { name: /try a (free )?search( first)?/i })
			.first();
		if (await tryASearchCta.isVisible({ timeout: 5_000 }).catch(() => false)) {
			await tryASearchCta.click();
		}

		const inputs = page.getByPlaceholder("City or airport");
		await inputs.first().fill("SFO");
		await inputs.first().press("Enter");
		await inputs.nth(1).fill("SIN");
		await inputs.nth(1).press("Enter");

		const dateInputs = page.locator('input[type="date"]');
		await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS));
		await dateInputs.nth(1).fill(isoDaysFromToday(RETURN_DAYS));

		await page.locator('[data-testid="more-options-toggle"]').click();
		const selects = page.getByRole("combobox");
		await selects.first().selectOption("3");
		await selects.nth(2).selectOption("premium_economy");

		const searchResponsePromise = page.waitForResponse(
			(res) => /\/api\/search(\?|$)/.test(res.url()) && res.request().method() === "POST",
			{ timeout: 120_000 },
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		const response = await searchResponsePromise;
		expect(response.status(), "Authed /api/search must return 200").toBe(200);

		const body = (await response.json()) as {
			verdict?: { recommendation?: string };
		};
		const recommendation = body.verdict?.recommendation;
		expect(recommendation, `concrete recommendation; got ${recommendation}`).toMatch(
			/^(use_points|pay_cash)$/,
		);

		// Curated list renders.
		const curated = page.locator('[data-testid="curated-options"]');
		await expect(curated, "curated 3-option list must render").toBeVisible({ timeout: 60_000 });

		const cards = curated.locator('[data-testid="option-card"]');
		const count = await cards.count();
		console.log(`[smoke-pr3] rec=${recommendation} cards=${count}`);
		expect(count, "1–3 curated cards (capped at 3)").toBeGreaterThanOrEqual(1);
		expect(count).toBeLessThanOrEqual(3);

		// Exactly one highlighted.
		const highlighted = curated.locator('[data-testid="option-card"][data-best="true"]');
		await expect(highlighted, "exactly one highlighted card").toHaveCount(1);

		// Highlight tag matches the recommendation.
		const tag = (await curated.locator('[data-testid="best-tag"]').first().textContent()) ?? "";
		if (recommendation === "use_points") {
			expect(tag).toContain("USE POINTS");
		} else {
			expect(tag).toContain("PAY CASH");
		}
	});
});
