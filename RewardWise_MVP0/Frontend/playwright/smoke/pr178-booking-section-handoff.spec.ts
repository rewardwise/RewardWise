/**
 * Production smoke: PR #178 booking-section handoff display fixes.
 *
 * Pre-fix bugs (live in prod 2026-05-30, BAY→SIN audit):
 *
 *   Bug B: Booking section "BOOK THROUGH YOUR PROGRAM" route line
 *     rendered the raw query CSV: "SFO,OAK,SJC → SIN".
 *     Root cause: VerdictCard built routeLabel from raw origin/destination
 *     props instead of bestOutbound.origin_airport / bestCashFlight
 *     .legs[0].departure_iata.
 *
 *   Bug C: Program header + card + CTA rendered the raw seats.aero key
 *     ("singapore", "cathay") instead of human display name
 *     ("Singapore KrisFlyer", "Cathay Pacific Asia Miles").
 *     Root cause: PROGRAM_DISPLAY_NAMES + PROGRAM_HOMEPAGE_URLS only
 *     covered ~10 of the ~24 keys backend emits via PROGRAM_ALIASES.
 *
 *   Bug D: "Book directly on {program}" rendered as a dead <span> with
 *     no navigable href (program key not in PROGRAM_HOMEPAGE_URLS).
 *     Root cause: getProgramHandoffInfo returned url === "#" for
 *     unmapped keys; MultiHandoffGrid's fallback span branch fires on
 *     that sentinel.
 *
 * Falsifying assertions (would pass pre-fix only if the page never
 * reached a state with the booking section visible — these checks are
 * negative-form so the spec stays meaningful across whatever verdict
 * prod returns at smoke time):
 *
 *   1. The raw metro CSV "SFO,OAK,SJC" MUST NOT appear anywhere in the
 *      visible DOM (it was leaking through the booking section route
 *      line pre-fix).
 *   2. No bare lowercase program slug may appear as a standalone token
 *      in the booking section text — we check for the most common BAY→
 *      Asia carriers that pre-fix had no display-name mapping.
 *   3. No "Book directly on …" dead-span text may appear; pre-fix that
 *      copy was the unmapped-program fallback, and it's no longer
 *      reachable now that every PROGRAM_ALIASES key resolves to a real
 *      https://www.{...}.com homepage.
 *
 * Trial-gate isolation: same synthetic-IP pattern as
 * pr177-missing-both-upstream-copy.spec.ts.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const DEPART_DAYS = 30

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR #178: booking-section handoff displays cleanly', () => {
  test('BAY→SIN PE +30d: no CSV leak, no raw slug, no dead CTA', async ({
    page,
    context,
  }) => {
    const syntheticIp = `smoke-booking-handoff-${randomUUID()}`
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

    // Search form defaults to Round Trip on prod, which renders two date
    // inputs (depart + return). For this smoke we only need a one-way to
    // exercise the booking section, so flip to One Way first — that hides
    // the return-date input so `dateInputs.first()` unambiguously matches
    // depart.
    const oneWayTab = page.getByRole('button', { name: /^One Way$/i })
    if (await oneWayTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await oneWayTab.click()
    }

    // Metro CSV on the origin is the trigger for Bug B — the leak only
    // surfaces when the search input expands to multiple airports.
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
    expect(
      response.status(),
      'Search must return 200 — display-only fix, no data-path changes.',
    ).toBe(200)

    // Wait for either a verdict block or an error/partial card so we
    // know the page reached its final render state before we sample
    // DOM text.
    const verdictBlock = page.locator('[data-testid="verdict-reasoning-block"]')
    const partialCard = page.locator('[data-testid="partial-data-card"]')
    const errorHeadline = page.getByRole('heading', {
      name: /(We could not pull data for this date|We couldn't reach pricing for this date right now)/i,
    })
    await expect(
      verdictBlock.or(partialCard).or(errorHeadline),
      'A near-date PE search must surface some card — full verdict, ' +
        'partial-data, or error state.',
    ).toBeVisible({ timeout: 60_000 })

    // Bug B falsifying assertion: the metro CSV that the user typed
    // must NEVER appear in the rendered DOM. Pre-fix it leaked into the
    // booking section route line ("SFO,OAK,SJC → SIN").
    await expect(
      page.getByText(/SFO,OAK,SJC/),
      'Bug B regression: raw metro CSV leaked into a visible surface ' +
        '(most likely the booking-section route line). Fix lives in ' +
        'VerdictCard.tsx — routeLabel must derive from bestOutbound' +
        '.origin_airport / bestCashFlight.legs[0].departure_iata.',
    ).toHaveCount(0)

    // Bug C falsifying assertion: bare lowercase program slugs that
    // pre-fix had no display-name mapping must not surface as
    // standalone tokens. We pick the BAY→SIN repro carrier
    // ("singapore") and a few other common Asia handoffs that share
    // the same bug class. Word-boundary regex avoids false matches on
    // "Singapore KrisFlyer" (which contains "Singapore", not
    // lowercase "singapore" as its own token).
    const bareSlugs = [
      /\bsingapore\b/,
      /\bcathay\b/,
      /\bqatar\b/,
      /\bturkish\b/,
      /\betihad\b/,
      /\bemirates\b/,
    ]
    for (const slugRe of bareSlugs) {
      await expect(
        page.getByText(slugRe),
        `Bug C regression: bare lowercase program slug ${slugRe} surfaced ` +
          'in the DOM. PROGRAM_DISPLAY_NAMES is missing an entry; fix it ' +
          'in Frontend/utils/airlines.ts.',
      ).toHaveCount(0)
    }

    // Bug D falsifying assertion: the dead-CTA fallback copy from
    // MultiHandoffGrid (the `<span>Book directly on {displayName}</span>`
    // branch) must not render. Post-fix every key resolves to a real
    // homepage URL so this branch is unreachable.
    await expect(
      page.getByText(/Book directly on/i),
      'Bug D regression: the dead-CTA "Book directly on …" fallback ' +
        'span rendered. getProgramHandoffInfo returned url === "#" for a ' +
        'program key, which means PROGRAM_HOMEPAGE_URLS is missing an ' +
        'entry OR the slug-synthesis fallback in airlines.ts regressed.',
    ).toHaveCount(0)
  })
})
