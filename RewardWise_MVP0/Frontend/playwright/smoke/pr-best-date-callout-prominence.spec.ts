/**
 * Production smoke: PR BEST-DATE-CALLOUT — flex-date searches must render
 * a prominent banner (not the tiny inline pill) when Zoe picks a date that
 * differs from what the user entered. ClickUp 86ba4tc81.
 *
 * Pre-fix bug: when flex-date scanning surfaced a "best date" different from
 * the user's entered date, the only UI signal was a small green inline pill
 * (text-xs, single-line, easy to skip). Users entered a date, Zoe quietly
 * swapped to a better date, and the user never noticed — they'd book on
 * the date they typed thinking that's what they searched.
 *
 * Post-fix UI contract:
 *   - When winning_date ≠ depart_date (or winning_return_date ≠ return_date),
 *     a block-level banner with `[data-testid="best-date-callout-prominent"]`
 *     renders, carrying role="status" + aria-live="polite", a "Better dates
 *     found" heading, the per-leg searched-range copy, and a calendar icon.
 *   - When flex is on but Zoe picked the user's entered dates, only the
 *     subtle `[data-testid="best-date-callout-subtle"]` pill renders.
 *   - When neither leg is flex, neither testid is in the DOM.
 *
 * Strategy: run a flex round-trip search, wait on /api/search response, then
 * inspect the rendered Verdict. If the response carries winning_date /
 * winning_return_date differing from the requested dates, assert the
 * prominent testid is visible and contains the heading. Otherwise assert
 * the subtle testid is visible. Either branch falsifies the pre-fix world
 * (only one inline pill existed).
 *
 * Runs against PLAYWRIGHT_BASE_URL — real seats.aero + FlightAPI cost, so
 * smoke is gated to post-merge in CI.
 */

import { test, expect } from '@playwright/test'

interface SearchResponse {
  winning_date?: string | null
  winning_return_date?: string | null
}

test.describe('PR BEST-DATE-CALLOUT: flex search shows prominent banner when a better date is picked', () => {
  test('JFK→LAX flex round-trip — prominent OR subtle callout renders per data', async ({
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
    const departIso = '2026-09-15'
    const returnIso = '2026-09-29'
    await dateInputs.first().fill(departIso)
    await dateInputs.nth(1).fill(returnIso)

    const selects = page.getByRole('combobox')
    await selects.first().selectOption('1')
    await selects.nth(1).selectOption('economy')

    const searchResponsePromise = page.waitForResponse(
      (res) => /\/api\/search(\?|$)/.test(res.url()) && res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()

    const searchResponse = await searchResponsePromise
    expect(searchResponse.ok(), 'search API must return 2xx').toBeTruthy()

    const body = (await searchResponse.json()) as SearchResponse

    // Wait for verdict to render before inspecting DOM.
    await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60_000 })

    const winningDate = body.winning_date ?? null
    const winningReturnDate = body.winning_return_date ?? null
    const outboundDiffers = winningDate !== null && winningDate !== departIso
    const returnDiffers = winningReturnDate !== null && winningReturnDate !== returnIso
    const expectsProminent = outboundDiffers || returnDiffers

    const prominent = page.locator('[data-testid="best-date-callout-prominent"]')
    const subtle = page.locator('[data-testid="best-date-callout-subtle"]')

    if (expectsProminent) {
      await expect(
        prominent,
        `Response carries a winning_date (${winningDate}) or winning_return_date ` +
          `(${winningReturnDate}) that differs from the entered dates (${departIso} / ` +
          `${returnIso}) — the prominent callout MUST render. Pre-fix would render ` +
          `the small inline pill instead.`,
      ).toBeVisible()
      await expect(prominent).toContainText('Better dates found')
      await expect(prominent).toHaveAttribute('aria-live', 'polite')
      await expect(prominent).toHaveAttribute('role', 'status')
      await expect(subtle).toHaveCount(0)
    } else {
      await expect(
        subtle,
        'Flex round-trip with winning dates equal to entered dates must render ' +
          'the subtle callout (not the prominent banner).',
      ).toBeVisible()
      await expect(prominent).toHaveCount(0)
    }
  })
})
