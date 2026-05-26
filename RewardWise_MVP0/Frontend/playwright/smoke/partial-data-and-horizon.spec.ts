/**
 * Production smoke: partial-data + horizon coverage.
 *
 * Locks the SEA-TYO 2027-04-20 repro behind automated regression coverage.
 * The bug: dates past the seats.aero ~10-month cash horizon collapsed onto
 * a generic "We could not pull the latest data" ErrorStateCard. The fix
 * spans PRs #140 (date-input helpers), #141 (calendar cap), #142 (verdict
 * type extraction prep), #143 (pre-submit warning), #144 (PartialDataCard
 * component), #145 (winner/CTA wiring), #146 (VerdictCard routing) —
 * routes degraded verdicts to a PartialDataCard with an actionable
 * winner + "Try a different date" CTA.
 *
 * Matrix: 4 tests × 6 projects (chromium/webkit/firefox × 1440/375) = 24 cells.
 *
 * Browser-specific notes:
 *   - WebKit (mobile) exercises iOS Safari's input[type="date"] focus +
 *     smooth-scroll interaction — guards the PR #146 M1 fix (250ms
 *     deferred focus + preventScroll).
 *   - Firefox 375 runs WITHOUT isMobile emulation (Firefox does not
 *     support it); viewport size alone exercises responsive breakpoints.
 *
 * Selector strategy: mirrors pr131-round-trip-return.spec.ts — production
 * search form has no testids, so form interactions use placeholder + role
 * fallbacks. Verdict surfaces (CashHorizonWarning, PartialDataCard) DO
 * carry data-testid attributes — those are the load-bearing assertions.
 */

import { test, expect, type Page } from '@playwright/test'

const AWARD_HORIZON_DAYS = 360 // mirrors utils/dateInput.ts DEFAULT

// Mirror production's UTC-based date math (utils/dateInput.ts `todayPlusDays`)
// to avoid local-vs-UTC skew at PT evening boundaries — `setDate()` advances
// in local time while `toISOString()` reports UTC, so the same call near
// midnight Pacific can land on different calendar days.
function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

async function selectAirport(page: Page, index: number, code: string) {
  const inputs = page.getByPlaceholder('City or airport')
  await inputs.nth(index).fill(code)
  await inputs.nth(index).press('Enter')
}

async function submitSearch(
  page: Page,
  opts: { origin: string; dest: string; depart: string; ret?: string },
) {
  await page.goto('/home')
  await selectAirport(page, 0, opts.origin)
  await selectAirport(page, 1, opts.dest)
  await page.getByRole('button', { name: /^Round Trip$/ }).click()
  const dateInputs = page.locator('input[type="date"]')
  await dateInputs.first().fill(opts.depart)
  if (opts.ret) await dateInputs.nth(1).fill(opts.ret)
  // DOM order of selects in home/page.tsx: TRAVELERS, STOPS, CABIN.
  // STOPS was added between TRAVELERS and CABIN after the pr131-* spec was
  // written — that spec still uses nth(1) for cabin and is broken at HEAD;
  // out of scope to fix here. New specs use nth(2) for cabin.
  const selects = page.getByRole('combobox')
  await selects.first().selectOption('1')
  await selects.nth(2).selectOption('economy')
  // Wait for the submit button to be enabled before clicking — Firefox
  // 375 in particular can resolve role-based selectors before the React
  // tree hydrates, leading to a click that fires against a stale handler.
  const submitBtn = page.getByRole('button', { name: /Search Flights/i })
  await expect(submitBtn).toBeEnabled()
  await submitBtn.click()
}

test.describe('Partial-data + horizon coverage', () => {
  test('Test 1 — calendar max attribute caps depart at AWARD_HORIZON_DAYS', async ({
    page,
  }) => {
    await page.goto('/home')
    const depart = page.locator('input[type="date"]').first()
    const maxAttr = await depart.getAttribute('max')
    expect(maxAttr, 'max attribute should be set on DEPART input').not.toBeNull()

    const todayIso = new Date().toISOString().split('T')[0]
    const maxDate = new Date(maxAttr as string)
    const todayDate = new Date(todayIso)
    const diffDays = Math.round(
      (maxDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    // Allow ±2 days slack for timezone / DST edge effects between client
    // mint and assertion run. The cap is the contract; exact day is not.
    expect(diffDays).toBeGreaterThanOrEqual(AWARD_HORIZON_DAYS - 2)
    expect(diffDays).toBeLessThanOrEqual(AWARD_HORIZON_DAYS + 2)

    // The 2099 sentinel must be gone — that was the pre-PR-141 cap.
    expect(maxAttr).not.toBe('2099-12-31')
  })

  test('Test 2 — cash-horizon warning toggles by date', async ({ page }) => {
    await page.goto('/home')
    const depart = page.locator('input[type="date"]').first()

    await depart.fill(isoDaysFromToday(350))
    await expect(
      page.locator('[data-testid="cash-horizon-warning"]'),
    ).toBeVisible()

    await depart.fill(isoDaysFromToday(100))
    await expect(
      page.locator('[data-testid="cash-horizon-warning"]'),
    ).toBeHidden()
  })

  test('Test 3 — past-horizon search renders PartialDataCard (the payoff)', async ({
    page,
  }) => {
    await submitSearch(page, {
      origin: 'SEA',
      dest: 'TYO',
      depart: isoDaysFromToday(350),
      ret: isoDaysFromToday(357),
    })

    // Wait for the verdict to land — partial-data card is the contract;
    // generic ErrorStateCard would be the regression.
    const partialCard = page.locator('[data-testid="partial-data-card"]')
    await expect(partialCard).toBeVisible({ timeout: 60_000 })

    // Regression guard: the generic "We could not pull the latest data"
    // copy must NOT be rendered. That string is unique to ErrorStateCard's
    // default headline (PR #146 added an override path for missing_both,
    // but past-horizon trips should route to PartialDataCard, not
    // ErrorStateCard).
    await expect(
      page.getByText(/We could not pull the latest data for this flight/i),
    ).toBeHidden()

    // Explanation copy from backend is surfaced — proves the card is
    // reading verdict.explanation, not a hardcoded fallback. The card
    // renders an eyebrow + headline + explanation + subtext + winner
    // block; total innerText > 100 chars proves backend content landed
    // (vs an empty shell with only static labels).
    const cardText = await partialCard.innerText()
    expect(cardText.length).toBeGreaterThan(100)

    // Verify CTA: present and points to an external link (airline_link
    // preferred, falls back to seats_aero_link). Either is acceptable.
    const verifyCta = page.locator('[data-testid="partial-data-verify-cta"]')
    await expect(verifyCta).toBeVisible()
    const href = await verifyCta.getAttribute('href')
    expect(href).toMatch(/^https?:\/\//)

    // Try-different-date CTA: bounces user back to DEPART picker.
    const retryCta = page.locator(
      '[data-testid="partial-data-retry-date-cta"]',
    )
    await expect(retryCta).toBeVisible()
    await retryCta.click()

    // After click: DEPART input is the active element. Focus assertion
    // is the most reliable cross-browser signal that the handler ran;
    // smoothScroll completion is timing-dependent and hard to assert
    // reliably across Chromium/WebKit/Firefox.
    const depart = page.locator('input[type="date"]').first()
    await expect(depart).toBeFocused({ timeout: 2_000 })
  })

  test('Test 4 — inside-horizon search does not regress to generic error', async ({
    page,
  }) => {
    // SEA-LAX (high-volume domestic) chosen over SEA-TYO because
    // SEA-TYO at 60 days still trips missing_cash (cash data sparse
    // for some int'l routes regardless of horizon). Whether a
    // confident verdict vs partial-data renders is route-dependent
    // and NOT the regression being guarded — the regression is the
    // generic ErrorStateCard headline showing on inside-horizon
    // searches, which the PR 5 routing fix prevents.
    await submitSearch(page, {
      origin: 'SEA',
      dest: 'LAX',
      depart: isoDaysFromToday(60),
      ret: isoDaysFromToday(67),
    })

    // Some recognized verdict surface must render — confident
    // verdict (verdict-reasoning-block), flight cards, or
    // partial-data card all acceptable. ErrorStateCard does not
    // emit any testid, so its absence is asserted explicitly below.
    const verdictRendered = page.locator(
      '[data-testid="verdict-reasoning-block"], [data-testid="partial-data-card"], [data-testid^="flight-card-"]',
    )
    await expect(verdictRendered.first()).toBeVisible({
      timeout: 60_000,
    })

    // Regression guard: generic error headline from ErrorStateCard
    // default copy must not render at 60 days inside-horizon. This
    // is the exact string PR #146 routed past-horizon trips AWAY
    // from — it must also not appear on a healthy inside-horizon
    // search.
    await expect(
      page.getByText(/We could not pull the latest data for this flight/i),
    ).toBeHidden()

    // Cash-horizon-warning (pre-submit calendar banner) only fires
    // at 350+ days; must stay hidden on a 60-day picker.
    await expect(
      page.locator('[data-testid="cash-horizon-warning"]'),
    ).toBeHidden()
  })
})
