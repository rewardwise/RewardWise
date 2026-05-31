/**
 * Production smoke: PR #177 cause-aware missing_both copy.
 *
 * Pre-fix bug (live in prod 2026-05-30, BAY→SIN audit):
 *   BAY (SFO,OAK,SJC) → SIN, Premium Economy, one-way, depart +6d.
 *   Backend returned cash=null AND awards=[], marked the verdict
 *   `data_quality: "missing_both"`, and the frontend rendered:
 *     "We could not pull data for this date. ...most providers don't
 *      publish data more than 10–11 months out."
 *   On a 6-day-out trip. That copy is a lie — the failure is upstream,
 *   not horizon.
 *
 * Post-fix UI contract for a within-horizon double-failure (+6d):
 *   - Search returns 200.
 *   - SOME card renders (full verdict, PartialDataCard, or an
 *     ErrorStateCard with upstream copy).
 *   - The horizon lie ("10–11 months out") MUST NOT appear.
 *   - If an ErrorStateCard renders the upstream variant, its headline
 *     reads "We couldn't reach pricing for this date right now".
 *
 * Why a separate smoke from pr-cause-aware-cash-copy: that one covers
 * the single-source (missing_cash) split. This covers the double-source
 * (missing_both) split — same lie, different code path on both sides.
 *
 * Trial-gate isolation: same synthetic-IP pattern as
 * pr-cause-aware-cash-copy.spec.ts.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const DEPART_DAYS = 6

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR #177: missing_both near-date does not lie about horizon', () => {
  test('SFO→SIN PE +6d falsifies the "10–11 months out" lie', async ({
    page,
    context,
  }) => {
    const syntheticIp = `smoke-missing-both-upstream-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
    })

    await page.goto('/')

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

    const selects = page.getByRole('combobox')
    await selects.nth(2).selectOption('premium_economy')

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/public-search(\?|$)/.test(res.url()) &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()
    const response = await searchResponsePromise
    const status = response.status()

    expect(
      status,
      'Search must return 200 — copy-fix only, no data-path changes.',
    ).toBe(200)

    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    const partialCard = page.locator('[data-testid="partial-data-card"]')
    const errorHeadline = page.getByRole('heading', {
      name: /(We could not pull data for this date|We couldn't reach pricing for this date right now)/i,
    })
    await expect(
      verdictBlock.or(partialCard).or(errorHeadline),
      'A near-date PE search must surface some card — full verdict, ' +
        'partial-data, or error state. Empty UI is its own regression.',
    ).toBeVisible({ timeout: 60_000 })

    // THE LIE: pre-fix copy that blamed the horizon on a 6-day-out trip.
    // Two phrasings — the long form lives in the missing_both_horizon
    // ErrorStateCard; the short form lives in the PartialDataCard horizon
    // subtext. Neither may render at +6d.
    await expect(
      page.getByText(/10[–-]11 months out/i),
      'PR #177 regression: a +6d PE search rendered the 10–11 months horizon ' +
        'copy. This may only render when depart > today+329d.',
    ).toHaveCount(0)

    await expect(
      page.locator('[data-testid="partial-data-cash-subtext-horizon"]'),
      'Horizon subtext rendered at +6d. Backend is mis-classifying a ' +
        'near-date upstream failure as a horizon failure.',
    ).toHaveCount(0)
  })
})
