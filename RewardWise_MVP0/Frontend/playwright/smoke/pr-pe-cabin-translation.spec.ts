/**
 * Production smoke: PR PE-CABIN-TRANSLATION — landing-page Premium Economy
 * public-search must not 500 with the misleading "create an account to
 * continue" message.
 *
 * Pre-fix bug (PR #22 regression, live from when that PR merged through
 * 2026-05-27): the validator enum was renamed from "premium" to
 * "premium_economy" without updating the outbound `cabins=` translation
 * in seats_service. seats.aero returned 400 invalid_cabin on every PE
 * search, which the generic exception handler in /api/public-search
 * wrapped into "Public search failed. Please try again or create an
 * account to continue." Customers assumed an account was needed and
 * bounced. Blast radius: every PE search (public AND authenticated)
 * since PR #22 merged. Today's customer report is one signal — the
 * actual incident spans the entire PE customer segment.
 *
 * Post-fix UI contract:
 *   - SFO→SIN, Round Trip, 3 travelers, Premium Economy, +120 days from
 *     today submits successfully (no 500).
 *   - On a 200 response the rendered surface is EITHER a full verdict
 *     ([data-testid="verdict-reasoning-block"]) OR a PartialDataCard
 *     ([data-testid="partial-data-card"]) — both prove the cabin
 *     translation succeeded and the verdict layer ran end-to-end.
 *     Either is PASS.
 *
 * Trial-gate isolation: /api/public-search is one-search-per-IP-hash with
 * no TTL on the trial row. Two failure modes if we rely on the CI egress
 * IP for trial accounting:
 *   (a) On a fresh-IP CI run the 1st viewport consumes the trial and the
 *       2nd gets 429 — handling that branch as PASS would mask a real
 *       regression on subsequent runs from the same IP, where BOTH
 *       viewports hit 429 before reaching seats.aero and the cabin bug
 *       goes undetected.
 *   (b) Once the IP is in the trial table, no in-band way to clear it.
 * Fix: synthesize a unique `cf-connecting-ip` (the backend's
 * first-priority IP header, see Backend/app/api/search.py:415) per
 * Playwright context. Each viewport gets a fresh IP-hash → fresh trial
 * row → unambiguous 200 (post-fix) or 500 (pre-fix). The 429 path becomes
 * unreachable, so the falsification is clean.
 *
 * Selectors mirror partial-data-and-horizon.spec.ts. storageState is
 * overridden to an empty session so the landing page does not redirect
 * an authenticated user straight to /home — public-search is the
 * surface under test.
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

test.describe('PR PE-CABIN: landing-page Premium Economy public-search renders without 500', () => {
  test('SFO→SIN round-trip PE on landing page falsifies the PR #22 cabin-invalid 500', async ({
    page,
    context,
  }) => {
    // Unique-per-run synthetic IP. Sent via all three headers the backend
    // trusts (cf-connecting-ip first, then x-real-ip, then x-forwarded-for
    // — see _client_ip_from_request) so the trial-gate hash is fresh on
    // every run, regardless of which Render edge IP this Playwright
    // worker happens to egress from. Prefix tags the row in the trial
    // table for trivial cleanup if it ever accumulates.
    const syntheticIp = `smoke-pe-cabin-${randomUUID()}`
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

    // Landing default is roundtrip (state initializer in app/page.tsx) —
    // the return date input is already visible, no trip-type click needed.

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS))
    await dateInputs.nth(1).fill(isoDaysFromToday(RETURN_DAYS))

    // Landing-page DOM order in roundtrip layout: TRAVELERS, STOPS, CABIN.
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
      'Pre-fix returned 500 with "create an account to continue" on every PE ' +
        'search. Post-fix must return 200 — synthetic cf-connecting-ip header ' +
        'guarantees a fresh trial row so the 429 trial-gate path is ' +
        'unreachable and cannot mask a regression.',
    ).toBe(200)

    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    const partialCard = page.locator('[data-testid="partial-data-card"]')
    await expect(
      verdictBlock.or(partialCard),
      'Post-fix 200 must render either a full verdict block or a PartialDataCard. ' +
        'Neither = silent failure (spinner-only state) which is its own regression.',
    ).toBeVisible({ timeout: 60_000 })
  })
})
