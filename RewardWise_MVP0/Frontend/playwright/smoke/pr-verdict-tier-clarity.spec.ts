/**
 * Production smoke: PR 3 verdict-tier explanation clarity (ClickUp 86b9v4aft).
 *
 * Pre-fix surface: every `use_points` verdict said WHICH program won and HOW
 * much it saved, but never WHY points cleared the bar. Users couldn't tell
 * whether a 1.85¢/pt redemption was "great" or "barely worth it" — both
 * rendered the identical headline + metrics box. The CPP number itself
 * only appeared as a pill inside AwardDetails, two viewports below the
 * verdict on mobile.
 *
 * Post-fix UI contract (use_points verdict only):
 *   - A tier badge ([data-testid="verdict-tier-badge"]) renders between
 *     the main explanation paragraph and the metrics box. Label is one
 *     of: "Premium value · X.XX¢/pt", "Solid value · X.XX¢/pt",
 *     "Marginal value · X.XX¢/pt". Tier comes from backend
 *     `verdict.verdict_tier` (premium ≥ 1.80¢, solid 1.50–1.79¢,
 *     marginal 1.25–1.49¢).
 *   - A threshold-context line ([data-testid="verdict-tier-explanation"])
 *     renders directly below the badge with the plain-English copy for
 *     that tier (one of three locked strings — see Backend
 *     verdict_service.py TIER_EXPLANATION_* constants).
 *   - A 4th tile ([data-testid="verdict-cpp-tile"]) joins the metrics
 *     grid (Cash | Points | Estimated savings | Point value). Pre-fix
 *     CPP was only visible inside the collapsible AwardDetails pill.
 *
 * Strategy: authenticated /home search for JFK→LAX one-way economy +14d.
 * The seeded smoke-test@ wallet carries enough premium-cabin transferable
 * point balances to produce a use_points recommendation on a domestic
 * award route. We wait on /api/search, read the response body to confirm
 * recommendation === "use_points" AND a tier was emitted, then assert
 * the three UI elements landed in the rendered DOM.
 *
 * If the seeded wallet produces a pay_cash verdict on this route (e.g.
 * award availability shifted, the route became sub-$250 cash), the spec
 * skips with a documented note rather than failing — the tier surface
 * is contractually omitted on pay_cash + wait, and asserting otherwise
 * would be a false alarm. This mirrors the pr-cause-aware-cash-copy
 * spec's "either full verdict or PartialDataCard is PASS" pattern.
 *
 * Auth: storageState is auto-applied by playwright.config.ts (global-setup
 * mints a Supabase session via service-role for MTW_SMOKE_EMAIL). No
 * per-spec mint needed.
 *
 * Runs against PLAYWRIGHT_BASE_URL — real seats.aero + FlightAPI cost.
 */

import { test, expect } from '@playwright/test'

const DEPART_DAYS = 14

interface SearchResponse {
	recommendation?: string | null
	verdict_tier?: string | null
	tier_explanation?: string | null
	winner?: { cpp?: number | null } | null
}

function isoDaysFromToday(days: number): string {
	const d = new Date()
	d.setUTCDate(d.getUTCDate() + days)
	return d.toISOString().split('T')[0]
}

test.describe('PR 3: verdict-tier explanation clarity (badge + threshold + CPP tile)', () => {
	test('JFK→LAX one-way economy use_points verdict surfaces tier badge, threshold copy, and CPP tile', async ({
		page,
	}) => {
		await page.goto('/home')

		// Defensive landing-nav guard: prod `/` and authenticated `/home`
		// may render a marketing landing page with an "Or try a search first
		// — no signup needed" CTA instead of the search form directly.
		// Click through it when present; otherwise fall through to the form.
		const tryASearchCta = page.getByRole('button', {
			name: /try a search first/i,
		})
		if (
			await tryASearchCta
				.isVisible({ timeout: 5_000 })
				.catch(() => false)
		) {
			await tryASearchCta.click()
		}

		const airportInputs = page.getByPlaceholder('City or airport')
		await airportInputs.first().fill('JFK')
		await airportInputs.first().press('Enter')
		await airportInputs.nth(1).fill('LAX')
		await airportInputs.nth(1).press('Enter')

		// One Way + Exact date + 1 passenger + Economy. Default form state on
		// /home is roundtrip/exact, so we only need to flip the trip-type toggle.
		await page.getByRole('button', { name: /^One Way$/ }).click()

		const dateInputs = page.locator('input[type="date"]')
		await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS))

		const selects = page.getByRole('combobox')
		await selects.first().selectOption('1')
		await selects.nth(1).selectOption('economy')

		const searchResponsePromise = page.waitForResponse(
			(res) =>
				/\/api\/search(\?|$)/.test(res.url()) &&
				res.request().method() === 'POST',
			{ timeout: 60_000 },
		)

		await page.getByRole('button', { name: /Search Flights/i }).click()

		const searchResponse = await searchResponsePromise
		expect(searchResponse.ok(), 'search API must return 2xx').toBeTruthy()

		const body = (await searchResponse.json()) as SearchResponse

		await expect(page.getByText(/^The Verdict$/i)).toBeVisible({
			timeout: 60_000,
		})

		// Tier surface only fires on use_points. If the seeded wallet produced
		// pay_cash or wait on this route (award gap, cheap cash), skip rather
		// than fail — the contract says tier is null on those branches.
		if (body.recommendation !== 'use_points') {
			test.skip(
				true,
				`Search returned recommendation="${body.recommendation}". Tier surface ` +
					`only renders on use_points; spec skipped to avoid a false alarm. ` +
					`If this skip becomes chronic, re-pick a route the seeded wallet ` +
					`reliably points-wins (or seed a heavier balance).`,
			)
			return
		}

		// Backend MUST emit a tier on use_points. If verdict_tier is null
		// post-PR-3, the BE classifier regressed.
		expect(
			body.verdict_tier,
			'Backend returned use_points without verdict_tier; PR 3 BE classifier ' +
				'should populate one of premium/solid/marginal for any use_points.',
		).toMatch(/^(premium|solid|marginal)$/)
		expect(
			body.tier_explanation,
			'Backend returned use_points + verdict_tier without tier_explanation; ' +
				'the two fields must be populated together.',
		).toBeTruthy()

		// ── Element 1: tier badge between mainExplanation and metrics box ──
		const tierBadge = page.locator('[data-testid="verdict-tier-badge"]')
		await expect(tierBadge).toBeVisible({ timeout: 30_000 })

		const tierAttr = await tierBadge.getAttribute('data-tier')
		expect(tierAttr).toBe(body.verdict_tier)

		const badgeText = (await tierBadge.textContent()) ?? ''
		const expectedLabel =
			body.verdict_tier === 'premium'
				? 'Premium value'
				: body.verdict_tier === 'solid'
					? 'Solid value'
					: 'Marginal value'
		expect(
			badgeText,
			`Tier badge must render the locked label for tier=${body.verdict_tier}.`,
		).toContain(expectedLabel)
		expect(
			badgeText,
			'Tier badge must render the CPP suffix "X.XX¢/pt" alongside the label.',
		).toMatch(/\d+\.\d{2}¢\/pt/)

		// ── Element 2: threshold-context line directly under the badge ──
		const tierExplanation = page.locator(
			'[data-testid="verdict-tier-explanation"]',
		)
		await expect(tierExplanation).toBeVisible()
		const explanationText = (await tierExplanation.textContent()) ?? ''
		// Loose containment: assert one of the three locked openers fires.
		// Exact-string assertion is owned by BE pytest + FE vitest; smoke
		// only needs to prove the threshold copy reached the rendered DOM.
		const lockedOpeners = [
			'one of the best uses of your points',
			'Your points stretch further than cash',
			'Barely better than cash',
		]
		expect(
			lockedOpeners.some((o) => explanationText.includes(o)),
			`Threshold line must contain one of the three locked openers. ` +
				`Got: ${JSON.stringify(explanationText.slice(0, 140))}`,
		).toBe(true)

		// Jargon guard: the FE-visible copy must not surface backend terms
		// the ELI5 ribbon explicitly banned. Bare word "redemption" is
		// permitted (it appears inside the "top-tier redemption" copy for
		// the solid tier); the forbidden compounds are "redemption rate",
		// "cents per point", "cpp".
		expect(
			explanationText,
			'Threshold copy leaked the "redemption rate" jargon ELI5 banned.',
		).not.toMatch(/redemption rate/i)
		expect(
			explanationText,
			'Threshold copy leaked the "cents per point" jargon ELI5 banned.',
		).not.toMatch(/cents per point/i)
		expect(
			explanationText,
			'Threshold copy leaked the "cpp" abbreviation ELI5 banned.',
		).not.toMatch(/\bcpp\b/i)

		// ── Element 3: CPP 4th tile lives inside the metrics box ──
		// Asserts the redemption-rate number is now first-class metric-grid
		// content, not only buried in the AwardDetails pill below the fold.
		const cppTile = page.locator('[data-testid="verdict-cpp-tile"]')
		await expect(cppTile).toBeVisible()
		const cppText = (await cppTile.textContent()) ?? ''
		expect(cppText).toContain('Point value')
		expect(cppText).toMatch(/\d+\.\d{2}¢\/pt/)
	})
})
