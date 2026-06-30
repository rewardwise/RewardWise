/**
 * Production smoke: PR 6 — Zoe light pane + deterministic verdict narration.
 *
 *  - b2 (natural): the docked Zoe lead message renders and matches the verdict
 *    (use points), the three chips render, clicking each appends a reply, and the
 *    actual zoe_lead_message_shown + zoe_chip_click analytics payloads are printed.
 *  - b3 (forced short): Zoe's lead says PAY CASH and NEVER "use your points" —
 *    the consistency guarantee, verified on prod.
 */

import { test, expect, type Page, type Request } from "@playwright/test";

function iso(d: number) {
	const x = new Date();
	x.setUTCDate(x.getUTCDate() + d);
	return x.toISOString().split("T")[0];
}

async function search(page: Page) {
	await page.goto("/home");
	const cta = page.getByRole("button", { name: /try a (free )?search( first)?/i }).first();
	if (await cta.isVisible({ timeout: 4000 }).catch(() => false)) await cta.click();
	const inp = page.getByPlaceholder("City or airport");
	await inp.first().fill("SFO");
	await inp.first().press("Enter");
	await inp.nth(1).fill("SIN");
	await inp.nth(1).press("Enter");
	const d = page.locator('input[type="date"]');
	await d.first().fill(iso(180));
	await d.nth(1).fill(iso(194));
	await page.locator('[data-testid="more-options-toggle"]').click();
	const s = page.getByRole("combobox");
	await s.first().selectOption("3");
	await s.nth(2).selectOption("premium_economy");
	const r = page.waitForResponse((x) => /\/api\/search(\?|$)/.test(x.url()) && x.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: /Search Flights/i }).click();
	await r;
}

function analytics(page: Page, eventName: string) {
	return page.waitForRequest((r: Request) => {
		if (!r.url().includes("/api/analytics") || r.method() !== "POST") return false;
		try {
			return (r.postDataJSON()?.event_name ?? "") === eventName;
		} catch {
			return false;
		}
	}, { timeout: 60_000 });
}

test.describe("PR 6: Zoe light narration (prod)", () => {
	test("b2 — lead message, chip clicks, analytics payloads", async ({ page }) => {
		test.setTimeout(180_000);
		const leadShown = analytics(page, "zoe_lead_message_shown");
		await search(page);

		const lead = page.locator('[data-testid="zoe-lead"]');
		await expect(lead).toBeVisible({ timeout: 60_000 });
		await expect(lead).toContainText(/use your points/i); // b2 = use points

		console.log("[smoke-pr6][lead_shown] =", JSON.stringify((await leadShown).postDataJSON().metadata));

		// Click each chip → a reply appears; capture the chip_click payload for one.
		const chipClick = analytics(page, "zoe_chip_click");
		await page.locator('[data-testid="zoe-chip-why"]').click();
		await expect(page.locator('[data-testid="zoe-docked"]')).toContainText(/redeems at|above the bar/i);
		console.log("[smoke-pr6][chip_click] =", JSON.stringify((await chipClick).postDataJSON().metadata));

		await page.locator('[data-testid="zoe-chip-points_anyway"]').click();
		await page.locator('[data-testid="zoe-chip-cheaper_dates"]').click();
		await expect(page.locator('[data-testid="zoe-docked"]')).toContainText(/Flexible dates/i);
	});

	test("b3 forced short — Zoe says pay cash, NEVER use points (consistency)", async ({ page }) => {
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
				Object.assign(v.ownership as Record<string, unknown>, {
					can_afford: false, owned_balance: 50000, points_needed: 237000, shortfall: 187000,
					buyable: true, buy_gap_cost: 5610, buy_gap_worth_it: false,
					fork_recommendation: "pay_cash", fork_reason: "short_buy_not_worth_it",
				});
			}
			await route.fulfill({ response: resp, json });
		});

		await search(page);
		const lead = page.locator('[data-testid="zoe-lead"]');
		await expect(lead).toBeVisible({ timeout: 60_000 });
		const text = (await lead.textContent()) ?? "";
		console.log("[smoke-pr6][b3 lead] =", text);
		expect(text.toLowerCase()).toContain("short");
		expect(text.toLowerCase()).not.toContain("use your points");
		await expect(page.locator('[data-testid="zoe-chip-why"]')).toContainText("Why cash?");
	});
});
