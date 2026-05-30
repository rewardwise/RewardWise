/**
 * Production smoke: PR-β1.5 — FlightAPI CABIN_CLASS_MAP fix.
 *
 * Pre-fix bug (live since CABIN_CLASS_MAP was introduced, audit + empirical
 * probe 2026-05-28): the title-case-with-space values
 * ("Premium Economy", "Business", "First") sent to FlightAPI returned
 * HTTP 400 every time. Only "Economy" was coincidentally tolerated. The
 * `raise_for_status()` in flightapi_provider then surfaced an empty
 * response with `cash_price=None`, and the verdict layer rendered a
 * PartialDataCard with the "cash temporarily unavailable" subtext —
 * even though FlightAPI WOULD return cash data if we sent the right
 * cabin string. Customer-visible symptom: every PE / Business / First
 * search showed award-only verdicts with a misleading "cash unavailable"
 * disclosure.
 *
 * Post-fix UI contract:
 *   - JFK → LHR, one-way, +60d from today, 1 traveler, Premium Economy
 *     submits successfully (200).
 *   - The rendered surface is a FULL verdict
 *     ([data-testid="verdict-reasoning-block"]) — NOT a PartialDataCard.
 *     Full verdict requires cash_price to be populated; PartialDataCard
 *     is the missing-cash path. Asserting the full surface IS the
 *     "cash data came back" assertion.
 *   - Neither the horizon subtext
 *     ([data-testid="partial-data-cash-subtext-horizon"]) nor the
 *     upstream subtext ([data-testid="partial-data-cash-subtext-upstream"])
 *     renders. These are the missing-cash variants PR-α (#154) shipped;
 *     if either appears at +60d, the FlightAPI call still returned null
 *     and the CABIN_CLASS_MAP fix did not actually reach end-to-end.
 *
 * Why the existing pr-pe-cabin-translation smoke isn't enough: that one
 * only proves PE search returns 200. Post-PR #153 + PR-α it does — but
 * with a PartialDataCard, not a full verdict, because FlightAPI was
 * still 400ing on the cabin string. The pre-fix prod state passes that
 * smoke. PR-β1.5 needs a stricter contract: the verdict surface must
 * be the cash-populated branch, falsifying the pre-fix
 * missing-cash-upstream rendering.
 *
 * Empirical basis (PR-β1 probe, 2026-05-28): direct FlightAPI call for
 * JFK→LHR premium_economy 2026-07-27 1-trav returned HTTP 200 with a
 * 548KB body of priced itineraries. That probe ran the exact URL
 * production builds (modulo cabin casing), so the route is known to
 * have cash data available.
 *
 * Trial-gate isolation + selectors mirror pr-pe-cabin-translation.spec.ts.
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

test.describe('PR-β1.5: FlightAPI CABIN_CLASS_MAP — PE cash data flows end-to-end', () => {
  test('JFK→LHR PE +60d renders a full verdict (cash populated), not a PartialDataCard', async ({
    page,
    context,
  }) => {
    // Synthetic IP via x-real-ip + x-forwarded-for only — cf-connecting-ip
    // is rejected by Cloudflare in front of Render (HTTP 403 / "error
    // code: 1000"). See pr-pe-cabin-translation file docstring for the
    // full trial-gate-isolation caveat under CF-fronted backends.
    const syntheticIp = `smoke-flightapi-cabin-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
    })

    await page.goto('/')

    // Defensive landing-nav guard: prod `/` may render a marketing
    // landing page with a "Try a (free) search (first)" CTA instead of
    // the search form directly. Click through when present; otherwise
    // fall through to the form.
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
    await inputs.first().fill('JFK')
    await inputs.first().press('Enter')
    await inputs.nth(1).fill('LHR')
    await inputs.nth(1).press('Enter')

    // Switch to one-way before filling dates so the second date input
    // disappears and we don't accidentally fill a return.
    await page.getByRole('button', { name: /One Way/i }).click()

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS))

    // One-way DOM order: TRAVELERS, STOPS, CABIN (same as roundtrip,
    // minus the return date input).
    const selects = page.getByRole('combobox')
    await selects.first().selectOption('1')
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
      'PR-β1.5 is a cabin-map fix, not a routing fix — search must still 200.',
    ).toBe(200)

    // Full verdict block must render. PartialDataCard is the
    // missing-cash path; its presence here means FlightAPI returned no
    // cash and the fix did not actually take effect end-to-end.
    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    await expect(
      verdictBlock,
      'Pre-fix this query rendered a PartialDataCard with missing-cash-upstream ' +
        'subtext because FlightAPI 400ed on "Premium Economy". Post-fix the ' +
        'full verdict-reasoning-block must render — cash_price populated, no ' +
        'partial-data surface.',
    ).toBeVisible({ timeout: 60_000 })

    await expect(
      page.locator('[data-testid="partial-data-card"]'),
      'PartialDataCard rendering at +60d PE = CABIN_CLASS_MAP fix did not flow ' +
        'end-to-end. Either Render env still has a bad FLIGHTAPI_KEY or the ' +
        'map was not actually deployed.',
    ).toHaveCount(0)

    // Defense in depth on PR-α (#154) data_quality dispatch: neither
    // missing-cash subtext should render when cash succeeded.
    await expect(
      page.locator('[data-testid="partial-data-cash-subtext-horizon"]'),
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="partial-data-cash-subtext-upstream"]'),
      'missing_cash_upstream subtext = FlightAPI still returned null. The ' +
        'cabin-map fix would have flipped this to a populated cash path.',
    ).toHaveCount(0)
  })
})
