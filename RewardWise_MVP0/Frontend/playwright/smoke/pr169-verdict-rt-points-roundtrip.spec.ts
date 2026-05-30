/**
 * Production smoke: PR #169 — verdict pipeline ships real round-trip points
 * total in metrics.points_cost, and VerdictCard renders that grand total +
 * a per-traveler caption.
 *
 * Pre-fix bug (verdict_service._metrics, live on prod 2026-05-30):
 *   points_cost           = winner.points × travelers   (one-way × N pax)
 *   points_cost_per_traveler  did not exist
 *   metrics.cpp           = winner.cpp (one-way per-pax — scope-mismatched)
 *   tier badge            = derived from winner.cpp, so bogus on RT × N
 *
 * For a SFO→SIN PE round-trip × 3 (Pat's bug report) seats.aero returns
 * SEPARATE outbound + return award objects, each carrying 79,000 points.
 * Pre-fix: points_cost = 79,000 × 3 = 237,000.
 * Post-fix: points_cost = (79,000 + 79,000) × 3 = 474,000.
 *
 * This spec drives a live RT search through the public surface (JFK→LAX
 * economy × 3 for CI reliability — bug shape is identical regardless of
 * route, since it lives in the metrics arithmetic), reads the /api/search
 * response, and asserts the response + DOM both reflect matched-scope:
 *
 *   1. response.metrics.points_cost > winner.points × travelers
 *      (proves the inbound winner was summed in — pre-fix this was equal)
 *   2. response.metrics.points_cost_per_traveler is present and > 0
 *   3. response.metrics.travelers === 3
 *   4. response.metrics.cpp is present (matched-scope reconciliation)
 *   5. [data-testid="verdict-points-total"] renders points_cost.toLocaleString()
 *   6. [data-testid="verdict-points-per-traveler"] is visible and matches
 *      `${points_cost_per_traveler.toLocaleString()} pts each · 3 travelers`
 *
 * Trial-gate isolation: fresh storageState + synthetic IP headers so the
 * public-search dedup doesn't burn the trial across runs.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getVercelBypassHeader } from '../auth/vercel-bypass'

interface AwardOption {
  points?: number | null
}

interface SearchResponse {
  winner?: { points?: number | null } | null
  metrics?: {
    points_cost?: number | null
    points_cost_per_traveler?: number | null
    travelers?: number | null
    cpp?: number | null
  } | null
  award_options?: AwardOption[]
  return_award_options?: AwardOption[]
}

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR #169: verdict pipeline ships matched-scope RT points total', () => {
  test.beforeEach(async ({ context }) => {
    const syntheticIp = `smoke-pr169-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
      ...getVercelBypassHeader(),
    })
  })

  test('JFK→LAX flex RT × 3 — metrics.points_cost reflects (out + ret) × travelers, DOM matches', async ({
    page,
  }) => {
    await page.goto('/home')

    const airportInputs = page.getByPlaceholder('City or airport')
    await airportInputs.first().fill('JFK')
    await airportInputs.first().press('Enter')
    await airportInputs.nth(1).fill('LAX')
    await airportInputs.nth(1).press('Enter')

    await page.getByRole('button', { name: /^Round Trip$/ }).click()
    await page.getByRole('radio', { name: /Flexible/i }).check()

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill('2026-09-15')
    await dateInputs.nth(1).fill('2026-09-29')

    const selects = page.getByRole('combobox')
    await selects.first().selectOption('3') // 3 travelers
    await selects.nth(1).selectOption('economy')

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/search(\?|$)/.test(res.url()) && res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()

    const searchResponse = await searchResponsePromise
    expect(searchResponse.ok(), 'search API must return 2xx').toBeTruthy()

    const body = (await searchResponse.json()) as SearchResponse

    // Verdict has to render to anchor the DOM assertions on something.
    await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60_000 })

    const metrics = body.metrics ?? {}
    const pointsCost = metrics.points_cost
    const pointsPerTraveler = metrics.points_cost_per_traveler
    const travelersResp = metrics.travelers

    // If seats.aero returns no awards at all for this leg/window, the verdict
    // pipeline degrades to a "wait" and points_cost is legitimately null —
    // the bug we're locking down doesn't apply. Skip rather than flake.
    test.skip(
      pointsCost == null,
      'no awards returned for this search window — verdict degraded, RT points fix does not apply',
    )

    // Post-fix contract on the API response itself:
    expect(pointsCost, 'metrics.points_cost must be present').toBeGreaterThan(0)
    expect(
      pointsPerTraveler,
      'metrics.points_cost_per_traveler must be present (new field in PR #169)',
    ).not.toBeNull()
    expect(pointsPerTraveler ?? 0).toBeGreaterThan(0)
    expect(travelersResp, 'metrics.travelers must echo the search input').toBe(3)
    expect(metrics.cpp, 'metrics.cpp must be matched-scope (PR #169)').not.toBeNull()

    // Reconciliation: points_cost === points_cost_per_traveler × travelers.
    expect(pointsCost).toBe((pointsPerTraveler ?? 0) * (travelersResp ?? 0))

    // Falsifying assertion against the pre-fix bug: pre-fix points_cost was
    // winner.points × travelers (one-way × N). For any RT search where the
    // backend picked a return winner, post-fix points_cost is strictly
    // greater than that. If return_award_options is empty (one-way fallback
    // path), the inequality collapses to equality — we only assert the
    // strict-> shape when a return winner was actually summed in.
    const winnerPts = body.winner?.points ?? null
    const hasReturnAward = (body.return_award_options ?? []).some(
      (o) => (o.points ?? 0) > 0,
    )
    if (winnerPts != null && winnerPts > 0 && hasReturnAward) {
      expect(
        pointsCost,
        `pre-fix bug: points_cost was winner.points × travelers = ${
          winnerPts * 3
        }. Post-fix must include the return winner's points.`,
      ).toBeGreaterThan(winnerPts * 3)
    }

    // DOM contract — the Best award tile renders the matched-scope total
    // and the per-traveler caption announces the round-trip per-pax cost.
    const expectedTotalText = `${pointsCost!.toLocaleString()} pts`
    await expect(
      page.locator('[data-testid="verdict-points-total"]'),
      `Best award tile must render metrics.points_cost (${expectedTotalText})`,
    ).toContainText(expectedTotalText, { timeout: 30_000 })

    const expectedPerTravelerText = `${(pointsPerTraveler ?? 0).toLocaleString()} pts each · 3 travelers`
    await expect(
      page.locator('[data-testid="verdict-points-per-traveler"]'),
      `Per-traveler caption must read "${expectedPerTravelerText}"`,
    ).toContainText(expectedPerTravelerText, { timeout: 10_000 })
  })
})
