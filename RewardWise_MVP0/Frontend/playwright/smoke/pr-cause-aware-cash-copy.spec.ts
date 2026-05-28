/**
 * Production smoke: PR-α cause-aware missing_cash copy.
 *
 * Pre-fix bug (live in prod 2026-05-28, audit report Phase 1): when the
 * cash provider chain returned no price for any reason — quota
 * exhaustion, timeout, route gap, anything — the backend marked the
 * verdict `data_quality: "missing_cash"` and the frontend rendered the
 * hardcoded "~10 months out" copy. For a +120d PE search (well inside
 * the 329d cash horizon), that copy is a lie: it blames the user's
 * date when the failure is on our side.
 *
 * The exact reproduction is screenshot A from the audit:
 *   BAY → SIN, round-trip, depart +120d, return +134d, 3 travelers,
 *   Premium Economy. Award path returns 79k Singapore but the cash
 *   price comes back null, and the card claims dates aren't typically
 *   available more than ~10 months out. We're at 4 months.
 *
 * Post-fix UI contract:
 *   - Search submits successfully (no 500).
 *   - On a 200, the rendered surface is EITHER:
 *       (a) a full verdict ([data-testid="verdict-reasoning-block"]), or
 *       (b) a PartialDataCard ([data-testid="partial-data-card"]).
 *     Either is PASS as long as the lie does not render.
 *   - The "~10 months out" copy MUST NOT appear anywhere on the page.
 *     This is the lie. Failing this assertion = PR-α did not fix the
 *     bug, or a regression reintroduced it.
 *   - If a PartialDataCard renders, it must be the upstream subtext
 *     ([data-testid="partial-data-cash-subtext-upstream"]) or no
 *     subtext at all. The horizon subtext
 *     ([data-testid="partial-data-cash-subtext-horizon"]) MUST NOT
 *     render at +120d.
 *
 * Why the existing pr-pe-cabin-translation smoke isn't enough: that one
 * proves PE searches return 200. It says nothing about the copy on the
 * resulting card. PR-α is a copy-honesty fix, so the smoke needs to
 * read the rendered text and falsify the horizon lie directly.
 *
 * Trial-gate isolation: same synthetic-IP pattern as
 * pr-pe-cabin-translation.spec.ts — a unique cf-connecting-ip/x-real-ip
 * /x-forwarded-for triple per run so the trial table is hashed fresh,
 * eliminating the 429 path that would otherwise mask regressions.
 *
 * Selectors and storageState pattern mirror pr-pe-cabin-translation.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const DEPART_DAYS = 120
const RETURN_DAYS = 134

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// Empty storageState: land on `/` un-authenticated so the public-search
// form is exercised instead of being redirected to /home.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR-α: cause-aware missing_cash copy does not lie about horizon', () => {
  test('SFO→SIN PE +120d falsifies the "~10 months out" lie', async ({
    page,
    context,
  }) => {
    const syntheticIp = `smoke-cause-aware-cash-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'cf-connecting-ip': syntheticIp,
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
    })

    await page.goto('/')

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
        /\/api\/public-search(\?|$)/.test(res.url()) &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()
    const response = await searchResponsePromise
    const status = response.status()

    expect(
      status,
      'Search must return 200 — PR-α is a copy fix, not a data fix, so the ' +
        'cabin path from PR #153 must still hold.',
    ).toBe(200)

    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    const partialCard = page.locator('[data-testid="partial-data-card"]')
    await expect(
      verdictBlock.or(partialCard),
      'Post-fix 200 must render either a full verdict block or a ' +
        'PartialDataCard. Neither = silent failure (spinner-only) and is ' +
        'its own regression.',
    ).toBeVisible({ timeout: 60_000 })

    // THE LIE: pre-fix copy that claimed cash data isn't available more
    // than ~10 months out, on a trip that's 4 months out. This assertion
    // is the falsifying condition for PR-α.
    await expect(
      page.getByText(/~10 months out/i),
      'PR-α regression: a +120d PE search rendered the "~10 months out" ' +
        'horizon copy. That copy may only render when depart > today+329d. ' +
        'Either the cause-aware split is broken or the legacy variant was ' +
        'reintroduced.',
    ).toHaveCount(0)

    // Defense in depth: if a PartialDataCard renders at all, it must NOT
    // be the horizon variant at this depart_date.
    await expect(
      page.locator('[data-testid="partial-data-cash-subtext-horizon"]'),
      'Horizon subtext rendered at +120d. The cause-aware split is wrong: ' +
        'either backend assigned missing_cash_horizon for a within-horizon ' +
        'date, or frontend dispatched the wrong variant.',
    ).toHaveCount(0)
  })
})
