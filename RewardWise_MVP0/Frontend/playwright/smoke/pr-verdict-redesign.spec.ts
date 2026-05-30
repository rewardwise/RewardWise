/**
 * Production smoke: PR VERDICT-REDESIGN — the post-Phase 3 results screen
 * must be coherent under either branch of the rescoped verdict gate.
 *
 * Coherence rewrite (this revision): the previous version hardcoded a
 * use_points expectation on the SFO→SIN PE×3 RT reference case. Under the
 * matched-scope cpp gate (PR #170), the same live query legitimately flips
 * to pay_cash when prod availability lands at cash − taxes / (points × pax
 * × legs) × 100 < 1.8¢. That is the honest answer, not a regression — and
 * a smoke that demands use_points on a route whose live recommendation
 * depends on real availability is a back-fit, not a contract. Deterministic
 * use_points / pay_cash coverage at the math level lives in the seeded
 * backend unit tests (already green); this smoke verifies that whichever
 * snapshot prod returns, the rendered surface is internally consistent.
 *
 * Coherence contract (assertions hold under EITHER recommendation):
 *   1. Verdict reasoning block actually renders — without this anchor, an
 *      empty/error state could trivially pass the layout assertions.
 *   2. recommendation ↔ metrics.cpp consistency — use_points iff cpp ≥ 1.8;
 *      otherwise pay_cash. Server gate and rendered recommendation cannot
 *      disagree.
 *   3. Reconciliation identity (use_points branch only) — cpp × points_cost
 *      / 100 ≈ estimated_savings within 2% rounding tolerance.
 *   4. Layout invariants under EITHER branch — no Set-alert button, no
 *      "Award booking" eyebrow (AwardDetailsSection folded), single-scroll
 *      surface (verdict renders inline on /home, not in a dialog/modal).
 *   5. Layout invariants under use_points only — side-by-side handoffs
 *      grid (md:grid-cols-2), headline leads with "Use points" with no
 *      `.99` cents, honesty line "pts instead of $...", per-traveler
 *      caption renders exactly once.
 *   6. (CONTRACT 8, fixme'd) — return-leg renders single IATA, not metro
 *      CSV. Pending the backend airport-resolution follow-up.
 *
 * Reference case (mirrors the locked Phase 3 design discussion):
 *   SFO → SIN, Round Trip, 3 travelers, Premium Economy, +180 days from
 *   today. PE long-haul commonly triggers a use_points verdict on
 *   Singapore/Aeroplan/etc. — but availability volatility means the same
 *   query can produce pay_cash on a different snapshot; both branches are
 *   honest answers, and this spec asserts coherence under whichever lands.
 *
 * Auth-path routing: drives the verdict via /home → /api/search rather than
 * / → /api/public-search. Rationale: /api/public-search is gated by a per-IP
 * trial table whose hash priority reads cf-connecting-ip first, and
 * Cloudflare in front of Render OVERWRITES cf-connecting-ip at the edge with
 * the real client IP — so the synthetic-IP spoof every public-search smoke
 * uses for isolation is silently ignored in prod. Once the CI egress IP
 * accumulates ≥ 3 trial rows, every public-search smoke returns 429
 * regardless of fix correctness. /api/search bypasses the trial gate
 * entirely; the authenticated session minted by globalSetup carries the
 * Supabase cookies the project's storageState surfaces. Verdict card
 * renders identically on both paths.
 *
 * The broken public-search isolation is tracked as a separate follow-up
 * (test-bypass header or move pe-cabin / cause-aware-cash / flightapi-
 * cabin-map / delta-metro-cash-fanout to /api/search). This spec does not
 * block on it.
 */

import { test, expect } from '@playwright/test'

const DEPART_DAYS = 180
const RETURN_DAYS = 194

// /api/search (authenticated) returns the verdict block nested under
// `verdict`, NOT at top-level. /api/public-search returns recommendation +
// metrics at top level — the two endpoints intentionally differ. We're on
// the authenticated path here (see "Auth-path routing" in the header
// docstring), so read from body.verdict.*.
interface SearchResponse {
  verdict?: {
    recommendation?: 'use_points' | 'pay_cash' | 'wait'
    metrics?: {
      cash_price?: number | null
      estimated_savings?: number | null
      points_cost?: number | null
      travelers?: number | null
      cpp?: number | null
    }
  }
}

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

test.describe('PR VERDICT-REDESIGN: post-Phase-3 results screen honors coherence contract', () => {
  test('SFO→SIN PE round-trip ×3 — verdict surface is coherent under either use_points or pay_cash snapshot', async ({
    page,
  }) => {
    // SFO autocomplete resolves to BAY (SFO·OAK·SJC) metro, so this is a
    // round-trip metro fan-out × 3 travelers × PE long-haul search. End-to-
    // end timing on preview (cold-start backend + multi-pair FlightAPI fan-
    // out + seats.aero range-mode) regularly exceeds the playwright.config
    // 60s default. Match the pr-delta-metro-cash-fanout headroom.
    test.setTimeout(180_000)

    await page.goto('/home')

    // Defensive landing-nav guard: prod `/home` may render a marketing
    // landing CTA above the search form depending on session state.
    // Click through when present; otherwise fall through to the form.
    const tryASearchCta = page
      .getByRole('button', {
        name: /try a (free )?search( first)?/i,
      })
      .first()
    if (
      await tryASearchCta.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await tryASearchCta.click()
    }

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
        /\/api\/search(\?|$)/.test(res.url()) &&
        res.request().method() === 'POST',
      { timeout: 120_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()
    const response = await searchResponsePromise

    expect(
      response.status(),
      'Authenticated /api/search must return 200 — redesign is a presentation ' +
        'fix, the PE cabin + reconciliation paths from PR #153 / backend ' +
        'metrics split must still hold.',
    ).toBe(200)

    const body = (await response.json()) as SearchResponse
    const recommendation = body.verdict?.recommendation
    const metrics = body.verdict?.metrics ?? {}
    const cash = metrics.cash_price ?? null
    const savings = metrics.estimated_savings ?? null
    const points = metrics.points_cost ?? null
    const cpp = metrics.cpp ?? null

    // Diagnostic — surfaces which branch the live snapshot landed on so a
    // future failure (or a "both branches seen" verification) can be traced
    // without re-running with --debug. Tagged for easy grep in CI logs.
    console.log(
      `[smoke-verdict-redesign] branch=${recommendation} cpp=${cpp} ` +
        `cash=${cash} savings=${savings} points=${points}`,
    )

    // COHERENCE — recommendation must be a terminal verdict, not "wait" or
    // missing. +180d PE long-haul should always produce a concrete answer.
    expect(
      recommendation,
      `Reference case must produce a concrete recommendation; got ${recommendation}.`,
    ).toMatch(/^(use_points|pay_cash)$/)

    // COHERENCE 1 — verdict block actually renders. Without this anchor,
    // an empty or error surface could trivially pass the layout assertions
    // (toHaveCount(0) is true on an empty DOM). Everything below scopes to
    // this block so the assertions can't pass on an unrendered page.
    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    await expect(
      verdictBlock,
      'Verdict reasoning block must render — every contract below lives ' +
        'inside it. An empty or error state must not pass as "coherent".',
    ).toBeVisible({ timeout: 60_000 })

    // COHERENCE 2 — recommendation is consistent with its own metrics.cpp.
    // Server gate: use_points iff matched cpp ≥ 1.8; otherwise pay_cash
    // (or gray-zone, which surfaces as pay_cash on the verdict card). The
    // smoke falsifies the case where the rendered recommendation contradicts
    // the cpp the server just emitted alongside it.
    expect(
      cpp != null,
      'metrics.cpp must be present on the response so recommendation/cpp ' +
        'coherence can be evaluated.',
    ).toBe(true)
    if (cpp != null) {
      if (recommendation === 'use_points') {
        expect(
          cpp,
          `recommendation=use_points requires matched cpp ≥ 1.8; got ${cpp.toFixed(4)}. ` +
            'Either the gate threshold drifted or the recommendation+metrics ' +
            'pair desynced (server bug).',
        ).toBeGreaterThanOrEqual(1.8)
      } else {
        expect(
          cpp,
          `recommendation=${recommendation} requires matched cpp < 1.8; got ${cpp.toFixed(4)}. ` +
            'A cpp ≥ 1.8 should have triggered use_points — recommendation+metrics desynced.',
        ).toBeLessThan(1.8)
      }
    }

    // COHERENCE 3 — reconciliation: cpp × points_cost / 100 ≈ estimated_savings.
    // Only meaningful when use_points is the verdict (savings is defined against
    // the points alternative). Pre-fix bug: savings was computed from the inflated
    // per-pax/per-leg ranking-score CPP, producing savings ≈ cash. Under matched-
    // scope cpp, the identity should reconcile within rounding tolerance.
    if (
      recommendation === 'use_points' &&
      cpp != null &&
      points != null &&
      savings != null
    ) {
      const reconciled = (cpp * points) / 100
      const relErr = Math.abs(reconciled - savings) / Math.max(savings, 1)
      expect(
        relErr,
        `Reconciliation: cpp(${cpp.toFixed(4)}¢) × points(${points}) / 100 = ` +
          `$${reconciled.toFixed(2)} must equal estimated_savings ($${savings.toFixed(2)}) ` +
          'within 2% tolerance. Larger divergence = matched-scope cpp and savings ' +
          'were not computed against the same scope.',
      ).toBeLessThan(0.02)
    }

    // LAYOUT 1 — no Set-alert button on the verdict surface, under EITHER
    // recommendation branch. Phase 3 removed it with useAlerts state.
    const setAlertInVerdict = verdictBlock.getByRole('button', {
      name: /set\s*alert/i,
    })
    await expect(
      setAlertInVerdict,
      'Set alert button must not render on the verdict surface — removed ' +
        'with useAlerts state in Phase 3.',
    ).toHaveCount(0)

    // LAYOUT 2 — AwardDetailsSection folded under EITHER branch. Its
    // "Award booking" eyebrow is the distinctive marker; absence proves
    // it is not in the DOM.
    await expect(
      verdictBlock.getByText(/^Award booking$/i),
      'AwardDetailsSection must be folded — its "Award booking" eyebrow ' +
        'should not render anywhere on the verdict card. Transfer + book ' +
        'flow now lives inside MultiHandoffGrid.',
    ).toHaveCount(0)

    // LAYOUT 3 — single-scroll surface. Verdict renders inline on /home, not
    // inside a modal/dialog. Phase 3 layout contract; valid under EITHER
    // recommendation branch. Falsifies a regression where the redesign would
    // re-introduce a stacked dialog/modal results screen.
    expect(
      page.url(),
      `URL drifted to ${page.url()} — verdict must remain on the single-scroll ` +
        '/home surface, not navigate to a separate results page.',
    ).toMatch(/\/home(\?|$|#)/)
    await expect(
      page.getByRole('dialog'),
      'No dialog/modal must wrap the verdict — single-scroll layout contract.',
    ).toHaveCount(0)

    // LAYOUT 4 — side-by-side handoffs grid. Only renders under use_points
    // when a RT pair surfaces both legs. Under pay_cash the handoffs section
    // is intentionally absent (no points to hand off), so the assertion is
    // scoped to the use_points branch.
    if (recommendation === 'use_points') {
      const handoffsGrid = page.locator('[data-testid="verdict-handoffs-grid"]')
      await expect(
        handoffsGrid,
        'Round-trip use_points with return handoff data must render the ' +
          'side-by-side grid wrapper. Single-leg fallback = return handoff ' +
          'data missing upstream.',
      ).toBeVisible()
      await expect(handoffsGrid).toHaveClass(/md:grid-cols-2/)
    }

    // USE_POINTS-BRANCH CONTRACTS — original Phase-3 reference-case
    // assertions. These guard the use_points presentation when the live
    // snapshot lands there: reconciliation magnitude (savings ≥ 50% cash),
    // no `.99` cents in headline, "Use points" headline lead, honesty line
    // with "pts instead of $...", and the per-traveler caption. Deterministic
    // use_points coverage at the math level lives in the seeded backend unit
    // tests; the smoke just verifies the rendered surface honors the redesign
    // when prod returns a use_points snapshot.
    if (recommendation === 'use_points') {
      if (cash != null && savings != null) {
        expect(
          savings,
          `Reconciliation magnitude: estimated_savings ($${savings.toFixed(0)}) ` +
            `must be at least 50% of cash_price ($${cash.toFixed(0)}). Below ` +
            'this threshold = inflated ranking-score CPP leaked into displayed ' +
            'savings, or matched-scope reconciliation regressed.',
        ).toBeGreaterThanOrEqual(0.5 * cash)
      }

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
          'on the use_points branch (reference contract).',
      ).toMatch(/^Use points/i)

      const honestyLine = page.locator('[data-testid="verdict-honesty-line"]')
      await expect(
        honestyLine,
        'use_points verdict with known cash must render the honesty line ' +
          '("{N} pts instead of ${cash} cash"). Naked savings headline = ' +
          'dishonesty pattern Phase 3 removed.',
      ).toBeVisible()
      await expect(honestyLine).toContainText(/pts? instead of \$/)

      const travelersDisclosure = page.locator(
        '[data-testid="verdict-points-per-traveler"]',
      )
      await expect(
        travelersDisclosure,
        'With 3 travelers, the per-traveler caption under Best award must ' +
          'render exactly once. Zero = silent (regression). Duplicate = ' +
          'AwardDetailsSection re-rendered alongside the metrics tile.',
      ).toHaveCount(1)
      await expect(travelersDisclosure).toContainText(/3 travelers/i)
    }

    // CONTRACT 8 assertions remain in the dedicated test.fixme() below
    // pending the metro-CSV → IATA backend resolution follow-up.
  })

  // CONTRACT 8 is fixme'd pending the airport-resolution backend follow-up PR.
  // Bug: return-leg airport pair renders the unresolved metro CSV (e.g.
  // "SFO,OAK,SJC") instead of a single resolved IATA per direction. The fix
  // is NOT in scope for this UI redesign PR — it lives in the backend, where
  // search.py needs to resolve metro CSV → single IATA from the award's
  // trips[].segments before emitting origin_airport / destination_airport.
  //
  // This PR ships:
  //   - include_endpoint_airports=True on BOTH legs (necessary but not
  //     sufficient — exposes the unresolved CSV downstream)
  //   - leg-route-{outbound,return} testids on FlightSection so the smoke
  //     can target the airport-pair element directly
  //
  // The follow-up PR will:
  //   - Resolve metro CSV → single IATA from the award's actual booked
  //     segments before emitting origin_airport / destination_airport
  //   - Remove the .fixme() marker below to flip this test green
  //
  // Per-founder rule: do NOT delete the assertion. The harness must survive
  // intact so the follow-up PR has a passing target to flip.
  test.fixme(
    'CONTRACT 8: return-leg renders single IATA (airport-resolution follow-up)',
    async ({ page }) => {
      test.setTimeout(180_000)

      await page.goto('/home')

      const tryASearchCta = page
        .getByRole('button', { name: /try a (free )?search( first)?/i })
        .first()
      if (
        await tryASearchCta.isVisible({ timeout: 5_000 }).catch(() => false)
      ) {
        await tryASearchCta.click()
      }

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
          /\/api\/search(\?|$)/.test(res.url()) &&
          res.request().method() === 'POST',
        { timeout: 120_000 },
      )

      await page.getByRole('button', { name: /Search Flights/i }).click()
      await searchResponsePromise

      // CONTRACT 8: Single-airport inbound origin. The inbound leg's
      // airport-pair element reads "{origin} → {destination}" (e.g.
      // "SIN → SFO"); neither side may be a CSV like "JFK,LGA,EWR" or
      // "SFO,OAK,SJC". Guards the Tier-3 leg synthesis path that consumes
      // origin_airport / destination_airport emitted by search.py with
      // include_endpoint_airports=True on both legs. Pre-follow-up: backend
      // emits the unresolved metro CSV in destination_airport, so Tier 3
      // synthesis dumps the CSV through to the FE verbatim. Follow-up PR
      // will resolve metro → single IATA from booked segments.
      const returnRoute = page.locator('[data-testid="leg-route-return"]')
      const returnRouteText = await returnRoute.first().innerText()
      expect(
        returnRouteText,
        `Return leg airport pair rendered "${returnRouteText}" — must not ` +
          'contain CSV airport codes. Single resolved IATA per direction is ' +
          'the Tier-3 contract.',
      ).not.toMatch(/[A-Z]{3},[A-Z]{3}/)
      expect(
        returnRouteText,
        `Return route "${returnRouteText}" must match "AAA → BBB" with ` +
          'single 3-letter IATA codes on each side.',
      ).toMatch(/^[A-Z]{3}\s*→\s*[A-Z]{3}$/)
    },
  )
})
