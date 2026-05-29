/**
 * Production smoke: PR-δ — multi-airport metro cash data fan-out.
 *
 * Pre-fix bug (live since commit 3f9e540 removed the multi-airport
 * validator pre-block, audit 2026-05-28): the FlightAPI provider URL
 * builder URL-encodes commas in origin / destination to `%2C`, which
 * FlightAPI's positional URL schema rejects as HTTP 400 (multi-origin)
 * or 404 (multi-destination). Every metro-area search (NYC, BAY, LAX,
 * TYO, LON, ...) silently dropped cash data — the verdict surface
 * rendered either `missing_cash_upstream` PartialDataCard (award-only
 * verdict with misleading subtext) or `missing_both` ErrorStateCard
 * (full failure).
 *
 * Post-fix UI contract:
 *   - NYC (JFK,LGA,EWR) → LON (LHR,LGW,STN,LCY), one-way, +60d,
 *     1 traveler, Economy submits successfully (200).
 *   - The rendered surface is a FULL verdict
 *     ([data-testid="verdict-reasoning-block"]) — NOT a PartialDataCard
 *     or ErrorStateCard. Full verdict requires cash_price to be
 *     populated; either of the missing-cash surfaces is the regression
 *     this PR fixes.
 *   - Neither the horizon subtext
 *     ([data-testid="partial-data-cash-subtext-horizon"]) nor the
 *     upstream subtext
 *     ([data-testid="partial-data-cash-subtext-upstream"]) renders.
 *
 * Falsifies pre-fix: this exact NYC → LON metro search returns
 * `missing_cash_upstream` on pre-PR-δ prod because FlightAPI 400s on
 * `JFK,LGA,EWR`. Post-fix the fan-out aggregates 12 per-pair calls and
 * the verdict surface gets a populated cash anchor.
 *
 * Metro selection works through the AirportSearch autocomplete
 * dropdown: typing the metro code (e.g., "NYC") surfaces a metro
 * result that, when selected, calls onChange with the comma-joined
 * CSV ("JFK,LGA,EWR"). Pressing Enter selects the first highlighted
 * autocomplete result.
 *
 * Trial-gate isolation + selectors mirror pr-flightapi-cabin-map.spec.ts.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const DEPART_DAYS = 60

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR-δ: multi-airport metro cash fan-out — cash data flows end-to-end', () => {
  test('NYC→LON Economy +60d renders a full verdict (cash populated), not missing_cash_upstream', async ({
    page,
    context,
  }) => {
    const syntheticIp = `smoke-metro-fanout-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'cf-connecting-ip': syntheticIp,
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
    })

    await page.goto('/')

    // Metro selection: type the metro code, the autocomplete surfaces a
    // metro result whose Enter-selection emits the comma-joined CSV.
    const inputs = page.getByPlaceholder('City or airport')
    await inputs.first().fill('NYC')
    await inputs.first().press('Enter')
    await inputs.nth(1).fill('LON')
    await inputs.nth(1).press('Enter')

    // One-way before filling the date so the second date input is gone.
    await page.getByRole('button', { name: /One Way/i }).click()

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS))

    // One-way DOM order: TRAVELERS, STOPS, CABIN.
    const selects = page.getByRole('combobox')
    await selects.first().selectOption('1')
    await selects.nth(2).selectOption('economy')

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/public-search(\?|$)/.test(res.url()) &&
        res.request().method() === 'POST',
      { timeout: 120_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()
    const response = await searchResponsePromise
    expect(
      response.status(),
      'PR-δ is a fan-out fix, not a routing fix — search must still 200.',
    ).toBe(200)

    // Full verdict block must render. Either missing-cash surface here
    // means the fan-out aggregate cash_price was null and the fix did
    // not flow end-to-end (likely Render hasn't picked up the new
    // commit yet, or the metro pairs are all failing upstream).
    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    await expect(
      verdictBlock,
      'Pre-fix this NYC→LON metro query rendered a PartialDataCard with ' +
        'missing_cash_upstream subtext because FlightAPI 400ed on ' +
        '"JFK,LGA,EWR". Post-fix the full verdict-reasoning-block must ' +
        'render — fan-out aggregated cash_price populated.',
    ).toBeVisible({ timeout: 120_000 })

    await expect(
      page.locator('[data-testid="partial-data-card"]'),
      'PartialDataCard at +60d Economy metro = fan-out did not reach end-to-end. ' +
        'Check Render deploy SHA against the PR-δ merge commit.',
    ).toHaveCount(0)

    await expect(
      page.locator('[data-testid="partial-data-cash-subtext-upstream"]'),
      'missing_cash_upstream subtext = aggregated cash_price still null. ' +
        'Either every metro pair failed upstream (provider outage) or the ' +
        'pricing_service routing did not fire.',
    ).toHaveCount(0)

    await expect(
      page.locator('[data-testid="partial-data-cash-subtext-horizon"]'),
    ).toHaveCount(0)
  })
})
