/**
 * Production smoke: PR 7 — slim 3-field search pill.
 *
 *  - From/To/When visible in the pill; travelers/cabin behind "More options".
 *  - A search submitted via the pill (with hidden cabin=business, pax=2 set under
 *    More) still flows those values through: the search_submitted analytics
 *    payload includes the hidden fields, and the verdict loads with a fork state.
 *  - Prints the actual search_submitted JSON.
 */

import { test, expect, type Request } from "@playwright/test";

function iso(d: number) {
	const x = new Date();
	x.setUTCDate(x.getUTCDate() + d);
	return x.toISOString().split("T")[0];
}

test.describe("PR 7: slim search pill (prod)", () => {
	test("submit via pill — hidden fields flow through, verdict loads, analytics JSON", async ({ page }) => {
		test.setTimeout(180_000);

		const submitted = page.waitForRequest((r: Request) => {
			if (!r.url().includes("/api/analytics") || r.method() !== "POST") return false;
			try {
				return (r.postDataJSON()?.event_name ?? "") === "search_submitted";
			} catch {
				return false;
			}
		}, { timeout: 120_000 });

		await page.goto("/home");
		const cta = page.getByRole("button", { name: /try a (free )?search( first)?/i }).first();
		if (await cta.isVisible({ timeout: 4000 }).catch(() => false)) await cta.click();

		// Pill: From / To / When visible; secondary fields collapsed by default.
		await expect(page.locator('[data-testid="search-pill"]')).toBeVisible({ timeout: 30_000 });
		await expect(page.locator('[data-testid="more-options"]')).toHaveCount(0);

		const inp = page.getByPlaceholder("City or airport");
		await inp.first().fill("SFO");
		await inp.first().press("Enter");
		await inp.nth(1).fill("SIN");
		await inp.nth(1).press("Enter");
		const d = page.locator('input[type="date"]');
		await d.first().fill(iso(180));
		await d.nth(1).fill(iso(194));

		// Expand More → set the hidden fields.
		await page.locator('[data-testid="more-options-toggle"]').click();
		await expect(page.locator('[data-testid="more-options"]')).toBeVisible();
		const selects = page.getByRole("combobox");
		await selects.first().selectOption("3"); // travelers = 3 (hidden)
		await selects.nth(2).selectOption("premium_economy"); // cabin (hidden, non-default, has award space)

		const searchResp = page.waitForResponse(
			(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 120_000 },
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();

		const payload = (await submitted).postDataJSON();
		console.log("[smoke-pr7] search_submitted =", JSON.stringify(payload));
		// Visible + HIDDEN field values are all in the payload.
		// (AirportSearch resolves "SFO" to its metro CSV "SFO,OAK,SJC".)
		expect(payload.search_origin).toContain("SFO");
		expect(payload.search_destination).toBe("SIN");
		expect(payload.search_cabin).toBe("premium_economy"); // hidden field flowed through
		expect(payload.search_travelers).toBe(3); // hidden field flowed through

		// The search actually ran with those params and a verdict loaded.
		expect((await searchResp).status()).toBe(200);
		await expect(page.locator('[data-testid="curated-options"]')).toBeVisible({ timeout: 60_000 });
	});
});
