/**
 * Production smoke: PR FLEX-SYMMETRY — both-flexible round-trip search must
 * send the same ±7 day window on outbound AND return legs (ClickUp 86ba4t25r).
 *
 * Pre-fix bug: buildSearchQueryParams shifted the outbound date back by 7
 * (date = depart − 7, date_end = depart + 7) but left the return date as-is
 * (return_date = returnDate, return_date_end = returnDate + 7). The return
 * leg's effective window was [returnDate, returnDate + 7] — a 7-day forward-
 * only window, half the size of the outbound 14-day ±7 window. User reported:
 * "outbound searches ±7 but return only searches forward 7."
 *
 * Post-fix invariant on the wire:
 *
 *     date_end   − date         = 14 days
 *     return_date_end − return_date = 14 days
 *     (i.e., outbound span === return span)
 *
 * Strategy: intercept the OUTGOING request to /api/search on a flex round-
 * trip and assert the four date params satisfy the invariant. Done at request
 * time (page.waitForRequest) because the bug lives in the query-string
 * construction, not the response shape.
 *
 * Runs against PLAYWRIGHT_BASE_URL (defaults to https://www.mytravelwallet.ai
 * in playwright.config.ts). Hits real seats.aero + FlightAPI — API quota cost
 * gates smoke to post-merge.
 */

import { test, expect } from '@playwright/test'

const DAY_MS = 86_400_000

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / DAY_MS
}

test.describe('PR FLEX-SYMMETRY: both-flex round-trip sends symmetric ±7 window per leg', () => {
  test('JFK→LAX flex round-trip — date_end−date === return_date_end−return_date', async ({
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
    await selects.first().selectOption('1')
    await selects.nth(1).selectOption('economy')

    const searchRequestPromise = page.waitForRequest(
      (req) => /\/api\/search(\?|$)/.test(req.url()) && req.method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()

    const searchRequest = await searchRequestPromise
    const url = new URL(searchRequest.url())
    const date = url.searchParams.get('date')
    const dateEnd = url.searchParams.get('date_end')
    const returnDate = url.searchParams.get('return_date')
    const returnDateEnd = url.searchParams.get('return_date_end')

    expect(date, '`date` must be set on flex search').toBeTruthy()
    expect(dateEnd, '`date_end` must be set on flex search').toBeTruthy()
    expect(returnDate, '`return_date` must be set on flex round-trip').toBeTruthy()
    expect(
      returnDateEnd,
      '`return_date_end` must be set on flex round-trip (regression guard for 86ba4t25r)',
    ).toBeTruthy()

    const outboundSpan = daysBetween(date!, dateEnd!)
    const returnSpan = daysBetween(returnDate!, returnDateEnd!)

    expect(outboundSpan, 'outbound window must span 14 days (±7)').toBe(14)
    expect(
      returnSpan,
      `return window must span 14 days (±7) — pre-fix was 7 days forward-only. ` +
        `Got return_date=${returnDate}, return_date_end=${returnDateEnd}`,
    ).toBe(14)
    expect(
      outboundSpan,
      'outbound and return windows must have IDENTICAL span (symmetric ±7 contract)',
    ).toBe(returnSpan)

    // UI sanity — verdict still renders post-fix.
    await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60_000 })
  })
})
