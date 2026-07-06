/**
 * Production smoke: PR 8c — landing rewire (light island hero + guest verdict).
 *
 * Pre-fix surface (dark glassmorphic scrollytelling landing, live pre-8c):
 *   - Navy #07101E hero over /beach-hero.png with radial glows, sticky
 *     STORY_STEPS scroll panel, savings-examples grid, testimonials.
 *   - Hero H1 "The fastest way to know if your points are worth using."
 *   - Guest verdict rendered <VerdictCard publicPreview> (rich, dark).
 *   - No guest Zoe FAB, no logged_out ownership fork, no "N of 3" counter.
 *
 * Post-fix UI contract (redesign 01-search.png / 02-verdict-loggedout.png):
 *   1. Light island hero. H1 = "Cash or points? We'll tell you.", subtitle +
 *      trust line "Free to try. No sign-up. 3 searches on us.". Search card
 *      CTA = "See the smartest way to pay".
 *   2. Below-hero (light): trust bar + 3-step how-it-works + sample verdict
 *      + wallet-connect CTA. Guest Zoe FAB bottom-right.
 *   3. Guest verdict = <CuratedOptions> (NOT VerdictCard) + a synthesized
 *      logged_out ownership fork (b1) inviting a wallet connect.
 *   4. b1 fork fires ownership_fork_shown{fork_reason:logged_out,logged_in:false}
 *      and connect-wallet fires ownership_fork_cta_click + routes to
 *      /signup?returnTo=<current path>.
 *   5. Free-trial exhaustion (backend 429) renders the paywall block state,
 *      not a generic error.
 *
 * Determinism: tests B/C route-mock the public-search endpoint so they never
 * consume real public_search_trials and pass identically on localhost or prod.
 * The real
 * end-to-end 3-then-4 backend gate is owned by the backend contract; here we
 * verify the FRONTEND handling of a 200 verdict and a 429 rejection.
 *
 * Runs guest (empty storageState) at both viewports via the config projects.
 */

import { test, expect, type Page, type Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getVercelBypassHeader } from "../auth/vercel-bypass";

test.use({ storageState: { cookies: [], origins: [] } });

// AirportSearch commits to the parent origin/destination only on a dropdown
// SELECT (not on raw typing) — so type, then ArrowDown+Enter to pick the top
// suggestion. Filling alone leaves the search button disabled.
async function pickAirport(page: Page, index: number, code: string) {
	const input = page.getByPlaceholder("City or airport").nth(index);
	await input.click();
	await input.fill(code);
	await input.press("ArrowDown");
	await input.press("Enter");
}

async function runGuestSearch(page: Page) {
	await pickAirport(page, 0, "SFO");
	await pickAirport(page, 1, "JFK");
	const dates = page.locator('input[type="date"]');
	await dates.nth(0).fill("2026-10-12");
	await dates.nth(1).fill("2026-10-20");
	await page.locator('[data-testid="landing-search-cta"]').click();
}

// A minimal use_points public-search result matching app/page.tsx SearchResult.
const VERDICT_FIXTURE = {
	search_id: "smoke-search-8c",
	verdict_id: "smoke-verdict-8c",
	public_trial_id: "smoke-trial-8c",
	origin: "SFO",
	destination: "SIN",
	date: "2026-10-12",
	return_date: "2026-10-20",
	cabin: "economy",
	travelers: 1,
	is_roundtrip: true,
	cash_price: 1200,
	price_level: "typical",
	typical_price_range: [900, 1500],
	flights: [],
	award_options: [
		{ program: "singapore", points: 95000, taxes: 80, direct: true, cpp: 2.4 },
		{ program: "flyingblue", points: 110000, taxes: 60, direct: false, cpp: 1.9 },
	],
	return_award_options: [],
	verdict: {
		verdict: "use_points",
		verdict_label: "Use Points",
		recommendation: "use_points",
		headline: "Points win here",
		explanation: "The award option beats the cash fare.",
		winner: { program: "singapore", points: 95000, taxes: 80, cpp: 2.4, direct: true },
		pay_cash: false,
		confidence: "high",
		booking_note: "",
		booking_link: { seats_aero_link: null, airline_link: null, preferred: "none" },
		metrics: { cash_price: 1200, points_cost: 95000, taxes: 80, cpp: 2.4, estimated_savings: 620 },
	},
};

test.describe("PR 8c: light island landing + guest verdict fork + paywall", () => {
	test.beforeEach(async ({ context }) => {
		const syntheticIp = `smoke-8c-${randomUUID()}`;
		await context.setExtraHTTPHeaders({
			"x-real-ip": syntheticIp,
			"x-forwarded-for": syntheticIp,
			...getVercelBypassHeader(),
		});
	});

	test("A. light island hero + below-hero light sections + guest FAB", async ({ page }) => {
		await page.goto("/");

		const h1 = page.locator('[data-testid="hero-h1"]');
		await expect(h1).toBeVisible();
		await expect(h1).toContainText(/cash or points\?\s*we'?ll tell you/i);

		// Trust line references the configurable free-search limit.
		await expect(page.getByText(/free to try\. no sign-up\./i)).toBeVisible();

		// Reskinned search card + redesign CTA copy.
		await expect(page.locator('[data-testid="search-pill"]')).toBeVisible();
		await expect(page.locator('[data-testid="landing-search-cta"]')).toContainText(
			/see the smartest way to pay/i,
		);

		// Old dark-landing surfaces must be GONE.
		await expect(page.getByRole("button", { name: /try a free search/i })).toHaveCount(0);
		await expect(page.locator('[data-testid="hero-savings-anchor"]')).toHaveCount(0);
		// Ported invariant (ex pr-marketing-homepage-revamp): a single primary
		// above-the-fold CTA — no competing account-creation button in the hero.
		await expect(page.getByRole("button", { name: /create your account/i })).toHaveCount(0);
		await expect(page.locator('[data-testid="landing-search-cta"]')).toHaveCount(1);

		// Below-hero light sections + guest Zoe FAB.
		await expect(page.getByText(/compare 30\+ points programs/i)).toBeVisible();
		await expect(page.getByText(/a real verdict looks like this/i)).toBeVisible();
		await expect(page.getByText(/see if you can book it with your points/i)).toBeVisible();
		await expect(page.locator('[data-testid="guest-zoe-fab"]')).toBeVisible();
	});

	test("B. guest verdict renders CuratedOptions + b1 logged_out fork; analytics + deep-link", async ({
		page,
	}) => {
		await page.route("**/api/public-search**", (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(VERDICT_FIXTURE),
			}),
		);

		// Capture ownership_fork analytics payloads.
		const forkEvents: any[] = [];
		await page.route("**/api/analytics**", (route: Route) => {
			try {
				const body = route.request().postDataJSON();
				if (body?.event_name?.startsWith("ownership_fork")) forkEvents.push(body);
			} catch {
				/* ignore non-JSON */
			}
			return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});

		await page.goto("/");
		await runGuestSearch(page);

		// Guest verdict = CuratedOptions + the logged_out fork (b1).
		const verdict = page.locator('[data-testid="guest-verdict"]');
		await expect(verdict).toBeVisible({ timeout: 15000 });
		await expect(page.locator('[data-testid="curated-options"]')).toBeVisible();

		// ⓐ (island spec v2): the guest verdict floats on the ISLAND — the results
		// section carries its own island backdrop (loaded), not the mint page bg.
		const resultsIsland = page.locator('[data-testid="landing-results"] img[src*="hero-island"]').first();
		await expect(resultsIsland).toBeAttached();
		expect(await resultsIsland.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
		const fork = page.locator('[data-testid="ownership-fork"]');
		await expect(fork).toBeVisible();
		await expect(fork).toHaveAttribute("data-fork", "logged_out");
		await expect(page.locator('[data-testid="fork-connect-wallet"]')).toBeVisible();
		await expect(page.locator('[data-testid="free-search-counter"]')).toContainText(/of 3 free/i);

		// ownership_fork_shown fired with logged_out + logged_in:false.
		expect(forkEvents.some((e) => e.event_name === "ownership_fork_shown")).toBeTruthy();
		const shown = forkEvents.find((e) => e.event_name === "ownership_fork_shown");
		expect(shown?.metadata?.fork_reason).toBe("logged_out");
		expect(shown?.metadata?.logged_in).toBe(false);

		// Connect wallet → cta analytics + deep-link to /signup?returnTo=.
		await page.locator('[data-testid="fork-connect-wallet"]').click();
		await expect(page).toHaveURL(/\/signup\?returnTo=/);
		expect(forkEvents.some((e) => e.event_name === "ownership_fork_cta_click")).toBeTruthy();
	});

	test("C. backend 429 renders the paywall block, not a generic error", async ({ page }) => {
		await page.route("**/api/public-search**", (route: Route) =>
			route.fulfill({
				status: 429,
				contentType: "application/json",
				body: JSON.stringify({
					detail: "You've used your 3 free searches. Create an account to keep comparing trips.",
				}),
			}),
		);

		await page.goto("/");
		await runGuestSearch(page);

		const block = page.locator('[data-testid="paywall-block"]');
		await expect(block).toBeVisible({ timeout: 15000 });
		await expect(block).toContainText(/used your 3 free searches/i);
		await expect(block.getByRole("button", { name: /create free account/i })).toBeVisible();
		// The generic inline error must NOT be what shows.
		await expect(page.locator('[data-testid="landing-search-error"]')).toHaveCount(0);
	});
});
