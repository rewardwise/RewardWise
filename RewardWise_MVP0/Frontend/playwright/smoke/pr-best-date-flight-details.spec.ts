/**
 * Production smoke: PR BEST-DATE-FLIGHT-DETAILS — Flight Details section
 * directly below the verdict must render trips on the SAME date the verdict
 * banner advertised, not on whichever date happened to be cheapest in the
 * raw award_options list (ClickUp 86ba4t6f1).
 *
 * Pre-fix bug: bestOutbound came out of dedupeByProgram, which collapses
 * multi-date entries to lowest-points-per-program — date-blind. On flex
 * round-trip searches, /api/search returns options spanning every date in
 * the ±7 window. United 28000 pts on 09-14 wins dedupe even though the
 * backend already picked 09-16 as winning_date. Result: verdict banner
 * says "Better dates found 2026-09-16", Flight Details below renders
 * trips on 2026-09-14. Anshu repro: two conflicting dates on the same
 * screen, user books the wrong one.
 *
 * Post-fix invariant: when /api/search response carries winning_date and
 * the chosen award_options[0].trips[0].segments[0].departs_at exists, the
 * date prefix on the FlightSection outbound header (e.g., "Sep 16") must
 * match the winning_date — never the user's entered departDate when those
 * differ.
 *
 * Strategy: run a flex round-trip search, wait on /api/search response,
 * read winning_date from the response body, then assert the FlightSection
 * header text contains the formatted winning_date. If winning_date equals
 * the entered date (Zoe didn't swap), assert the header carries that date
 * — same invariant, different value.
 *
 * Runs against PLAYWRIGHT_BASE_URL — real seats.aero + FlightAPI cost, so
 * smoke is gated to post-merge in CI.
 */

import { test, expect } from '@playwright/test'

interface SearchResponse {
  winning_date?: string | null
  winning_return_date?: string | null
}

function formatMonthDay(iso: string): string {
  // Match FlightSection's fmtDate output: "Sep 16" (en-US, month: short, day: numeric).
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

test.describe('PR BEST-DATE-FLIGHT-DETAILS: Flight Details date matches verdict winning_date', () => {
  test('JFK→LAX flex round-trip — outbound header date === winning_date', async ({
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

    await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60_000 })

    const winningDate = body.winning_date ?? null
    const winningReturnDate = body.winning_return_date ?? null

    // Open Flight Details if it's a collapsible section (UI shows the header
    // either inline or behind a disclosure).
    const detailsToggle = page.getByRole('button', { name: /Flight Details/i })
    if (await detailsToggle.count()) {
      await detailsToggle.first().click()
    }

    // The post-fix contract: outbound leg header carries the winning_date.
    // If winning_date is null (rare on a flex search but possible — Zoe
    // fell back), the header must still match SOME date in the searched
    // ±7 window. We assert against the winning_date when present.
    const expectedOutboundDate = winningDate ?? departIso
    const outboundLabel = formatMonthDay(expectedOutboundDate)

    await expect(
      page.getByText(outboundLabel, { exact: false }).first(),
      `Outbound leg header must render the winning_date (${expectedOutboundDate} → ` +
        `"${outboundLabel}"). Pre-fix bug 86ba4t6f1: dedupeByProgram surfaced the ` +
        `cheapest multi-date option, so this header rendered the entered date ` +
        `(${departIso}) or whichever other date was cheapest.`,
    ).toBeVisible({ timeout: 30_000 })

    // Same invariant on the return leg.
    const expectedReturnDate = winningReturnDate ?? returnIso
    const returnLabel = formatMonthDay(expectedReturnDate)
    await expect(
      page.getByText(returnLabel, { exact: false }).first(),
      `Return leg header must render the winning_return_date (${expectedReturnDate} → ` +
        `"${returnLabel}").`,
    ).toBeVisible({ timeout: 30_000 })
  })
})
