/**
 * Production smoke: PR VERDICT-REDESIGN — the post-Phase 3 results screen
 * must lead with dollar savings, pair them with a points-spent honesty line,
 * render side-by-side handoffs on desktop, fold AwardDetailsSection, and
 * surface a single travelers-disclosure when travelers > 1. ClickUp redesign.
 *
 * Pre-fix surface (live until Phase 3): headline read "Use points — 4.01¢ per
 * point", honesty line absent, travelers disclosure missing or doubled,
 * AwardDetailsSection rendered below the metrics tile (duplicating transfer
 * info already in the handoff cards), Set alert button + dead handlers
 * persisted, and savings could regress to ≈cash (the inflated ranking-score
 * CPP × points bug that the matched-scope metrics.cpp split fixed).
 *
 * Post-fix UI contract (all assertions falsify a specific regression):
 *   1. Reconciliation guard — server-side metrics.estimated_savings must be
 *      at least 50% of metrics.cash_price. The bug we're guarding against is
 *      savings ≈ cash (savings - taxes anchored to inflated ranking CPP), which
 *      would print "Save ~$9,499 on a $9,499 fare" — nonsense. 50% is a wide
 *      band; real PE long-haul savings are 70–95%. Anything below 50% means
 *      reconciliation broke.
 *   2. No `.99` in the headline — Phase 3 locked 0-decimal money on the hero
 *      line. A `.99` slip means fmtMoney(x, 0) regressed somewhere upstream.
 *   3. Honesty line present — "{N} pts instead of ${cash} cash" must render
 *      whenever recommendation=use_points and cash is known. A naked savings
 *      headline without the trade-off is the dishonesty pattern we removed.
 *   4. Exactly one travelers-disclosure — with 3 travelers, "for 3 travelers
 *      (X pts each)" appears once under Best award, not zero (silent) and not
 *      duplicated by both metrics tile + AwardDetailsSection.
 *   5. No Set alert button — Phase 3 removed it along with useAlerts state.
 *      Any "Set alert"/"Set Alert" text on the verdict surface = regression.
 *   6. Handoffs side-by-side on ≥768px — the wrapper div carries
 *      `md:grid-cols-2`. Pre-Phase-3 they stacked vertically.
 *   7. AwardDetailsSection absent — the "Award booking" eyebrow that
 *      identified that section must not render anywhere on the verdict card.
 *      Its content already lives inside the numbered Transfer-then-Book flow
 *      in MultiHandoffGrid.
 *   8. Single-airport inbound origin — leg-header-return must contain a
 *      single 3-letter IATA code on each side of the arrow, NOT a CSV like
 *      "JFK,LGA,EWR" or "SFO,OAK,SJC". This guards the Tier-3 origin/destination
 *      resolution that search.py threads via include_endpoint_airports=True
 *      on both legs.
 *
 * Reference case (mirrors the locked Phase 3 design discussion):
 *   SFO → SIN, Round Trip, 3 travelers, Premium Economy, +120 days from
 *   today. PE long-haul reliably triggers a use_points verdict on
 *   Singapore/Aeroplan/etc., which is what the redesign was scoped against.
 *
 * Same trial-gate isolation pattern as pr-pe-cabin-translation + cause-aware-
 * cash-copy: synthetic cf-connecting-ip per run so the trial table is fresh
 * and the 429 path cannot mask a regression.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const DEPART_DAYS = 120
const RETURN_DAYS = 134

interface SearchResponse {
  recommendation?: 'use_points' | 'pay_cash' | 'wait'
  metrics?: {
    cash_price?: number | null
    estimated_savings?: number | null
    points_cost?: number | null
    travelers?: number | null
  }
}

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR VERDICT-REDESIGN: post-Phase-3 results screen honors all 8 contract items', () => {
  test('SFO→SIN PE round-trip ×3 falsifies regressions on headline, handoffs, disclosure, and reconciliation', async ({
    page,
    context,
  }) => {
    const syntheticIp = `smoke-verdict-redesign-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'cf-connecting-ip': syntheticIp,
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
    })

    await page.goto('/')

    const inputs = page.getByPlaceholder('City or airport')
    await inputs.first().fill('SFO')
    await inputs.first().press('Enter')
    await inputs.nth(1).fill('SIN')
    await inputs.nth(1).press('Enter')

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS))
    await dateInputs.nth(1).fill(isoDaysFromToday(RETURN_DAYS))

    const selects = page.getByRole('combobox')
    await selects.first().selectOption('3')
    await selects.nth(2).selectOption('premium_economy')

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/public-search(\?|$)/.test(res.url()) &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()
    const response = await searchResponsePromise

    expect(
      response.status(),
      'Public search must return 200 — redesign is a presentation fix, the ' +
        'PE cabin + reconciliation paths from PR #153 / backend metrics split ' +
        'must still hold.',
    ).toBe(200)

    const body = (await response.json()) as SearchResponse

    // Gate: this smoke only exercises the use_points contract. A pay_cash or
    // wait verdict at +120d PE long-haul on this route would itself be a
    // surprise — fail loudly so we investigate rather than silently skip.
    expect(
      body.recommendation,
      `Reference case expected use_points; got ${body.recommendation}. ` +
        'Either upstream data shifted (real availability change, fine — ' +
        'update DEPART_DAYS) or recommendation logic regressed (not fine).',
    ).toBe('use_points')

    // CONTRACT 1: Reconciliation guard. Pre-fix bug: savings ≈ cash because
    // ranking-score CPP × points was used as the displayed savings. Real PE
    // long-haul savings sit at 70–95% of cash; 50% is a deliberately wide
    // floor that still cleanly catches the savings≈cash regression.
    const cash = body.metrics?.cash_price ?? null
    const savings = body.metrics?.estimated_savings ?? null
    expect(
      cash != null && savings != null,
      'Reference case must surface both cash_price and estimated_savings ' +
        'metrics — reconciliation cannot be evaluated otherwise.',
    ).toBe(true)
    if (cash != null && savings != null) {
      expect(
        savings,
        `Reconciliation guard: estimated_savings ($${savings.toFixed(0)}) ` +
          `must be at least 50% of cash_price ($${cash.toFixed(0)}). Below ` +
          'this threshold = the inflated ranking-score CPP leaked into ' +
          'displayed savings, or matched-scope reconciliation regressed.',
      ).toBeGreaterThanOrEqual(0.5 * cash)
    }

    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    await expect(
      verdictBlock,
      'Full verdict block must render — redesign assertions all live inside it.',
    ).toBeVisible({ timeout: 60_000 })

    // CONTRACT 2: No `.99` cents in headline. Hero is the h2 rendered inside
    // VerdictTopRow; .99 in its text means an upstream caller passed a
    // non-rounded float to a money formatter.
    const headline = page.getByRole('heading', { level: 2 }).first()
    await expect(headline).toBeVisible()
    const headlineText = await headline.innerText()
    expect(
      headlineText,
      `Headline rendered "${headlineText}" — must not contain ".99" cents. ` +
        'Phase 3 locked 0-decimal money on the hero line.',
    ).not.toMatch(/\.99\b/)
    expect(
      headlineText,
      `Headline rendered "${headlineText}" — must lead with "Use points" ` +
        'for the reference use_points case (reference contract).',
    ).toMatch(/^Use points/i)

    // CONTRACT 3: Honesty line. Pair the savings with the points-spent
    // trade-off so the recommendation is never a one-sided sell.
    const honestyLine = page.locator('[data-testid="verdict-honesty-line"]')
    await expect(
      honestyLine,
      'use_points verdict with known cash must render the honesty line ' +
        '("{N} pts instead of ${cash} cash"). Naked savings headline = ' +
        'dishonesty pattern Phase 3 removed.',
    ).toBeVisible()
    await expect(honestyLine).toContainText(/pts? instead of \$/)

    // CONTRACT 4: Exactly one travelers-disclosure for travelers=3.
    const travelersDisclosure = page.locator(
      '[data-testid="verdict-travelers-disclosure"]',
    )
    await expect(
      travelersDisclosure,
      'With 3 travelers, the per-traveler disclosure under Best award must ' +
        'render exactly once. Zero = silent (regression). Duplicate = ' +
        'AwardDetailsSection re-rendered alongside the metrics tile.',
    ).toHaveCount(1)
    await expect(travelersDisclosure).toContainText(/for 3 travelers/i)

    // CONTRACT 5: No Set alert button. Phase 3 removed it. Use a verdict-
    // scoped locator so a Set Alert button on /watchlist (different surface)
    // can't leak in via shared layout.
    const setAlertInVerdict = verdictBlock.getByRole('button', {
      name: /set\s*alert/i,
    })
    await expect(
      setAlertInVerdict,
      'Set alert button must not render on the verdict surface — removed ' +
        'with useAlerts state in Phase 3.',
    ).toHaveCount(0)

    // CONTRACT 6: Handoffs side-by-side on ≥768px. The wrapper div carries
    // md:grid-cols-2; viewport default is 1280px so the desktop branch
    // exercises here.
    const handoffsGrid = page.locator('[data-testid="verdict-handoffs-grid"]')
    await expect(
      handoffsGrid,
      'Round-trip use_points with return handoff data must render the ' +
        'side-by-side grid wrapper. Single-leg fallback = return handoff ' +
        'data missing upstream.',
    ).toBeVisible()
    await expect(handoffsGrid).toHaveClass(/md:grid-cols-2/)

    // CONTRACT 7: AwardDetailsSection absent. Its distinctive marker is the
    // "Award booking" eyebrow; absence proves it's not in the DOM.
    await expect(
      verdictBlock.getByText(/^Award booking$/i),
      'AwardDetailsSection must be folded — its "Award booking" eyebrow ' +
        'should not render anywhere on the verdict card. Transfer + book ' +
        'flow now lives inside MultiHandoffGrid.',
    ).toHaveCount(0)

    // CONTRACT 8: Single-airport inbound origin. Inbound leg-header reads
    // "{origin} → {destination}". Neither side may be a CSV. Guards the
    // Tier-3 leg synthesis path that consumes origin_airport/destination_airport
    // emitted by search.py with include_endpoint_airports=True on both legs.
    const returnLegHeader = page.locator(
      '[data-testid="leg-header-return"]',
    )
    if ((await returnLegHeader.count()) > 0) {
      const returnHeaderText = await returnLegHeader.first().innerText()
      expect(
        returnHeaderText,
        `Return leg header rendered "${returnHeaderText}" — must not contain ` +
          'CSV airport codes (e.g. "JFK,LGA,EWR"). Single resolved IATA per ' +
          'direction is the Tier-3 contract.',
      ).not.toMatch(/[A-Z]{3},[A-Z]{3}/)
    }
  })
})
