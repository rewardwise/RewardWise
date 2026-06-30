/**
 * Production smoke: PR 5 — ownership-fork UI (b2/b3) + analytics.
 *
 * Verifies the end-to-end wiring on the live verdict route:
 *  - b2 (natural, the smoke user's real wallet covers SFO→SIN): the fork renders
 *    `owned_sufficient` with a book-with-points CTA.
 *  - b3 (forced via a response patch — live availability won't reliably make the
 *    user short): the fork renders `short_buy_not_worth_it`, recommends pay cash,
 *    and shows NO buy / points-alert CTA.
 *  - For each, it captures the ACTUAL /api/analytics `ownership_fork_shown`
 *    payload and prints the JSON to the smoke output.
 *
 * Decision logic (b2/b3) is covered deterministically in backend pytest +
 * OwnershipFork vitest; this proves the data→UI→analytics wiring on prod.
 */

import { test, expect, type Request } from "@playwright/test";

function iso(days: number) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().split("T")[0];
}

async function runSearch(page: import("@playwright/test").Page) {
	await page.goto("/home");
	const cta = page.getByRole("button", { name: /try a (free )?search( first)?/i }).first();
	if (await cta.isVisible({ timeout: 4000 }).catch(() => false)) await cta.click();
	const inputs = page.getByPlaceholder("City or airport");
	await inputs.first().fill("SFO");
	await inputs.first().press("Enter");
	await inputs.nth(1).fill("SIN");
	await inputs.nth(1).press("Enter");
	const dates = page.locator('input[type="date"]');
	await dates.first().fill(iso(180));
	await dates.nth(1).fill(iso(194));
	const selects = page.getByRole("combobox");
	await selects.first().selectOption("3");
	await selects.nth(2).selectOption("premium_economy");
	const resp = page.waitForResponse(
		(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
		{ timeout: 120_000 },
	);
	await page.getByRole("button", { name: /Search Flights/i }).click();
	await resp;
}

function forkAnalytics(page: import("@playwright/test").Page) {
	return page.waitForRequest((r: Request) => {
		if (!r.url().includes("/api/analytics") || r.method() !== "POST") return false;
		try {
			return (r.postDataJSON()?.event_name ?? "") === "ownership_fork_shown";
		} catch {
			return false;
		}
	}, { timeout: 60_000 });
}

test.describe("PR 5: ownership-fork UI + analytics (prod)", () => {
	test("b2 owned_sufficient — natural wallet, real analytics payload", async ({ page }) => {
		test.setTimeout(180_000);
		const analyticsP = forkAnalytics(page);
		await runSearch(page);

		const fork = page.locator('[data-testid="ownership-fork"]');
		await expect(fork).toBeVisible({ timeout: 60_000 });
		expect(await fork.getAttribute("data-fork")).toBe("owned_sufficient");
		await expect(fork.locator('[data-testid="fork-cta"]')).toBeVisible(); // book points

		const payload = (await analyticsP).postDataJSON();
		console.log("[smoke-pr5][b2] ownership_fork_shown.metadata =", JSON.stringify(payload.metadata));
		expect(payload.metadata.fork_reason).toBe("owned_sufficient");
		expect(payload.metadata.can_afford).toBe(true);
		expect(payload.metadata.shortfall).toBe(0);
	});

	test("b3 short_buy_not_worth_it — forced, pay cash, no buy/alert CTA, real payload", async ({ page }) => {
		test.setTimeout(180_000);
		await page.route("**/api/search**", async (route) => {
			const resp = await route.fetch();
			let json: Record<string, unknown>;
			try {
				json = await resp.json();
			} catch {
				return route.fulfill({ response: resp });
			}
			const v = json.verdict as Record<string, unknown> | undefined;
			if (v && v.ownership && typeof v.ownership === "object") {
				const o = v.ownership as Record<string, unknown>;
				o.can_afford = false;
				o.owned_balance = 50000;
				o.points_needed = 237000;
				o.shortfall = 187000;
				o.buyable = true;
				o.buy_rate_cpp = 3.0;
				o.redemption_cpp = 1.9;
				o.buy_gap_cost = 5610;
				o.buy_gap_worth_it = false;
				o.fork_recommendation = "pay_cash";
				o.fork_reason = "short_buy_not_worth_it";
			}
			await route.fulfill({ response: resp, json });
		});

		const analyticsP = forkAnalytics(page);
		await runSearch(page);

		const fork = page.locator('[data-testid="ownership-fork"]');
		await expect(fork).toBeVisible({ timeout: 60_000 });
		expect(await fork.getAttribute("data-fork")).toBe("short_buy_not_worth_it");
		await expect(fork).toContainText(/pay cash/i);
		await expect(fork.locator('[data-testid="fork-cta"]')).toHaveCount(0); // no buy/book CTA

		const payload = (await analyticsP).postDataJSON();
		console.log("[smoke-pr5][b3] ownership_fork_shown.metadata =", JSON.stringify(payload.metadata));
		expect(payload.metadata.fork_reason).toBe("short_buy_not_worth_it");
		expect(payload.metadata.can_afford).toBe(false);
		expect(payload.metadata.shortfall).toBeGreaterThan(0);
	});
});
