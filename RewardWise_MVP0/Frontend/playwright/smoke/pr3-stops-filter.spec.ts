/**
 * Production smoke: PR #135 (ticket 86ba2ze4g) - Stops filter is honored on search.
 *
 * RETROACTIVE spec. PR #135 (merged 2026-05-23 at b1366b9) shipped the
 * Stops filter end-to-end (validator enum, three provider call sites,
 * frontend select + URL contract) but missed the smoke spec that the
 * project-wide rule (Frontend/playwright/smoke/README.md "Adding a new
 * spec") requires for every user-visible bug PR. This spec closes that
 * gap so the same rule violation cannot recur silently.
 *
 * Pre-fix behavior (before b1366b9): the Stops select did not exist on
 * the search form; max_stops was not threaded into SerpAPI / FlightAPI /
 * seats.aero, so users had no way to constrain results by leg count.
 * Post-fix behavior: choosing "Nonstop only" causes every flight card on
 * the verdict to render as "Nonstop".
 *
 * Runs against PLAYWRIGHT_BASE_URL (defaults to https://www.mytravelwallet.ai
 * in playwright.config.ts). Hits real seats.aero + FlightAPI; runs are
 * post-merge gated, not per-PR-push.
 *
 * Selector strategy mirrors pr131-round-trip-return.spec.ts. The Stops
 * select is identified by its unique "Nonstop only" option rather than
 * by position, so it survives reorders of the travelers/stops/cabin row.
 *
 * Deterministic-safe: count === 0 is a PASS. If a route returns zero
 * flights when constrained to nonstop, that is the filter being honored
 * (not a flake). A real regression renders flights with "1 stop" /
 * "2 stops" text inside the flight-card.
 */

import { test, expect } from '@playwright/test'

test.describe('PR #135 (86ba2ze4g): Stops filter is honored on search', () => {
  test('Stops=Nonstop returns only Nonstop flight cards', async ({ page }) => {
    await page.goto('/home')

    // FROM / TO airport inputs share placeholder; first = origin, second = dest.
    const airportInputs = page.getByPlaceholder('City or airport')
    await airportInputs.first().fill('JFK')
    await airportInputs.first().press('Enter')
    await airportInputs.nth(1).fill('LAX')
    await airportInputs.nth(1).press('Enter')

    // One-way keeps the API quota cost down and removes return-leg
    // assertion noise; the filter contract is the same either way.
    await page.getByRole('button', { name: /^One Way$/ }).click()

    // Depart date input is first input[type="date"]. Compute a date ~6
    // weeks out at run time so the spec does not silently start failing
    // when a hard-coded date drifts into the past or into a low-inventory
    // window. 6 weeks balances award-window typical-ness against the
    // chance of a populated nonstop result set on this transcon route.
    const departDate = new Date(Date.now() + 42 * 86400_000)
      .toISOString()
      .slice(0, 10)
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill(departDate)

    // Travelers + cabin: identified by their option text so this spec is
    // robust to the search-form grid reordering (rather than .nth(0/2)).
    const travelersSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: /1 Traveler$/ }),
    })
    await travelersSelect.selectOption('1')
    const cabinSelect = page.locator('select').filter({
      has: page.locator('option[value="economy"]'),
    })
    await cabinSelect.selectOption('economy')

    // Stops select: identified by its unique "Nonstop only" option.
    const stopsSelect = page.locator('select').filter({
      has: page.locator('option[value="nonstop"]'),
    })
    await stopsSelect.selectOption('nonstop')

    await page.getByRole('button', { name: /Search Flights/i }).click()

    // Wait for verdict to render. The Verdict header is unique to
    // VerdictTopRow and only paints after a successful search returns.
    await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60_000 })

    // Flight details header MUST render before we accept count === 0 as
    // a PASS. Without this gate, a silent verdict-rendered-but-zero-cards
    // state (provider quota, partial outage, low-inventory route) would
    // mask filter regressions by short-circuiting on a hollow verdict.
    await expect(page.getByText(/^Flight details$/i)).toBeVisible()

    const flightCards = page.locator('[data-testid^="flight-card-"]')
    const count = await flightCards.count()

    // Deterministic-safe: zero flight cards is a PASS. The filter is
    // honored even when no nonstop flights exist; that is not a flake.
    if (count === 0) return

    // Every rendered flight card must contain "Nonstop" (matches the
    // stopLabel string emitted by FlightSection.tsx:110 when stopCount
    // === 0) and must NOT contain "1 stop" / "2 stops" text.
    for (let i = 0; i < count; i++) {
      const card = flightCards.nth(i)
      await expect(card).toContainText(/Nonstop/)
      await expect(card).not.toContainText(/\b\d+\s+stops?\b/i)
    }
  })
})
