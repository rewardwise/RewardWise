/**
 * Production smoke: PR #131 — round-trip Use Points return flight renders.
 *
 * Regression target: prior to commit a13d418, the verdict card on a
 * round-trip Use Points search would render only the OUTBOUND segment;
 * the RETURN segment was silently dropped. This spec asserts both legs
 * render on production after merge.
 *
 * Runs against PLAYWRIGHT_BASE_URL (defaults to https://www.mytravelwallet.ai
 * in playwright.config.ts). Hits real seats.aero + FlightAPI — every run
 * costs API quota, so smoke runs are gated to post-merge, not per-PR-push.
 *
 * Viewports: spec executes once per Playwright project. The two auth
 * projects (chromium-1440-auth, chromium-375-auth) give us desktop + mobile
 * coverage in a single `npx playwright test playwright/smoke/` invocation.
 *
 * Selector strategy: production has no data-testid on the search form or
 * verdict card; the only testids are on flight cards / leg headers / segment
 * rows inside FlightSection. Form interactions therefore use role + position
 * fallbacks (matches the pattern in playwright/tests/critical-paths.spec.ts).
 * The PR #131 assertion uses the flight-card testids that DO exist:
 *   [data-testid="flight-card-outbound"] / [data-testid="flight-card-return"]
 * (suffix derived from FlightSection.tsx leg.label.toLowerCase()).
 */

import { test, expect } from '@playwright/test'

test.describe('PR #131: Round-trip Use Points return flight renders', () => {
  test('SEA to BAY round-trip flex ±7 shows both outbound and return', async ({ page }) => {
    await page.goto('/home')

    // FROM / TO airport inputs share placeholder; first = origin, second = dest.
    // Pressing Enter selects the first dropdown suggestion (matches the
    // selectAirport() helper pattern in critical-paths.spec.ts).
    const airportInputs = page.getByPlaceholder('City or airport')
    await airportInputs.first().fill('SEA')
    await airportInputs.first().press('Enter')
    await airportInputs.nth(1).fill('BAY')
    await airportInputs.nth(1).press('Enter')

    // Trip type: rendered as a button, not a radio. Round Trip is the default,
    // but click for explicit state.
    await page.getByRole('button', { name: /^Round Trip$/ }).click()

    // Date mode: "Flexible (±7 days)" is a real radio, not a switch.
    await page.getByRole('radio', { name: /Flexible/i }).check()

    // Date inputs are native input[type="date"] — first = depart, second = return.
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill('2026-05-28')
    await dateInputs.nth(1).fill('2026-06-04')

    // Travelers + Cabin: vanilla <select> elements, no aria-label linkage.
    // Order in DOM (per home/page.tsx): travelers first, cabin second.
    const selects = page.getByRole('combobox')
    await selects.first().selectOption('1')
    await selects.nth(1).selectOption('economy')

    // Submit.
    await page.getByRole('button', { name: /Search Flights/i }).click()

    // Wait for verdict to render. "The Verdict" header text is unique to
    // VerdictTopRow and only appears after a successful search returns.
    await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60_000 })

    // PR #131 assertion: BOTH legs render in Flight Details. Pre-fix, the
    // return leg's flight-card was missing entirely from the DOM.
    await expect(page.getByText(/^Flight details$/i)).toBeVisible()
    await expect(page.locator('[data-testid="flight-card-outbound"]')).toBeVisible()
    await expect(page.locator('[data-testid="flight-card-return"]')).toBeVisible()

    // Count assertion: exactly 2 flight cards (one per leg). Catches both
    // "return missing" (count=1) and "duplicate render" (count>=3) regressions.
    const flightCards = page.locator('[data-testid^="flight-card-"]')
    await expect(flightCards).toHaveCount(2)

    // Mobile-only horizontal-scroll check: catches layout overflow on 375px.
    // Tolerates 1px sub-pixel rounding via the `+ 1` slack.
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })
})
