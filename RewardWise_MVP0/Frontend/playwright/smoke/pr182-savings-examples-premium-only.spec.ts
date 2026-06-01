/**
 * Production smoke: PR #182 — SAVINGS_EXAMPLES must only ship verdicts
 * whose matched-scope cpp clears the use_points strong threshold (≥ 1.8).
 *
 * Pre-fix surface (live on www.mytravelwallet.ai through 2026-05-31):
 *   The homepage "Real verdicts" section shipped three cards after PR #180,
 *   but two of them sat below the use_points cpp threshold:
 *
 *     JFK → LHR Business / Qatar Avios / $1,349 / 99,000 pts / $0 tax
 *       → cpp = (1349−0)/99000 × 100 = 1.36   (pay_cash band, not use_points)
 *     SFO → BLR Economy  / United MileagePlus / $675 / 49,500 pts / $5.60 tax
 *       → cpp = (675−5.60)/49500 × 100 = 1.35  (pay_cash band, not use_points)
 *
 *   Frontend backend gate (Backend/app/services/verdict_service.py):
 *     CPP_USE_POINTS_STRONG_THRESHOLD = 1.8
 *
 *   Live impact: a visitor sees three cards advertised as "Real verdicts,
 *   real savings" and "what you would have saved by booking with rewards",
 *   but two of those three would actually under-perform cash on a real
 *   matched-scope run. The "Anna problem" — we showcase pay-cash
 *   redemptions as use-points wins.
 *
 * Post-fix contract:
 *   Each rendered card's matched-scope cpp, derived from the displayed cash,
 *   points, and taxes via cpp = (cash − taxes) / points × 100, must be ≥ 1.8.
 *   No editorial trust: the spec re-derives cpp from the DOM rather than
 *   asserting the curated values in page.tsx, so a future SAVINGS_EXAMPLES
 *   refresh that silently slips in a sub-threshold card is caught by the
 *   same test.
 *
 * Falsifies pre-fix: against the pre-#182 prod surface, two of the three
 * derived cpps come out at ≈1.36 — the assertion ≥ 1.8 fails on cards 0
 * and 2, and the test reports the failing cpps in the error message.
 *
 * Trial-gate isolation: synthetic x-real-ip + x-forwarded-for headers per
 * test so PR #181's count-based public-search gate doesn't poison reruns
 * (the SAVINGS_EXAMPLES section is static / above-the-fold and doesn't
 * itself hit the search endpoint, but the homepage as a whole touches it
 * in the same SSR pass, so isolation stays cheap insurance).
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getVercelBypassHeader } from '../auth/vercel-bypass'

const USE_POINTS_STRONG_THRESHOLD = 1.8

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR #182: every SAVINGS_EXAMPLES card clears matched-scope cpp ≥ 1.8', () => {
  test.beforeEach(async ({ context }) => {
    const syntheticIp = `smoke-pr182-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
      ...getVercelBypassHeader(),
    })
  })

  test('section renders 3 cards and each derived cpp ≥ 1.8', async ({ page }) => {
    await page.goto('/')

    const section = page.locator('[data-testid="savings-examples-section"]')
    await expect(section).toBeVisible()

    const cards = page.locator('[data-testid="savings-example-card"]')
    await expect(cards).toHaveCount(3)

    // Per-card derivation. The card markup (Frontend/app/page.tsx) renders:
    //   Cash   $X
    //   Points Y pts  <program> + $T tax
    //   You save $S       (S = X − T by construction)
    //
    // We re-derive cpp from cash, points, and taxes pulled off the DOM
    // (not from the curated savings number) so a future card that slips
    // in with a bad taxes value still trips the gate.
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i)
      const cardText = await card.innerText()

      // Cash and "You save" both render as bare "$X" amounts; the second
      // dollar token under "Points" is the taxes value, prefixed by
      // " + $T tax".
      const cashMatch = cardText.match(/Cash[\s\S]*?\$([\d,]+(?:\.\d+)?)/)
      // Card markup shortens five-figure point amounts via a k-suffix
      // ("112k pts" for 112,000) — capture the optional "k" so the
      // derivation still works on the rendered abbreviation.
      const pointsMatch = cardText.match(/([\d,]+(?:\.\d+)?)(k)?\s*pts/i)
      const taxMatch = cardText.match(/\+\s*\$([\d,]+(?:\.\d+)?)\s*tax/i)

      expect(cashMatch, `card ${i}: no "Cash $X" in card text\n${cardText}`).not.toBeNull()
      expect(pointsMatch, `card ${i}: no "Y pts" in card text\n${cardText}`).not.toBeNull()
      expect(taxMatch, `card ${i}: no "+ $T tax" in card text\n${cardText}`).not.toBeNull()

      const cash = Number(cashMatch![1].replace(/,/g, ''))
      const pointsRaw = Number(pointsMatch![1].replace(/,/g, ''))
      const points = pointsMatch![2] ? pointsRaw * 1000 : pointsRaw
      const taxes = Number(taxMatch![1].replace(/,/g, ''))

      expect(Number.isFinite(cash), `card ${i}: cash parse failure`).toBe(true)
      expect(Number.isFinite(points) && points > 0, `card ${i}: points parse failure`).toBe(true)
      expect(Number.isFinite(taxes), `card ${i}: taxes parse failure`).toBe(true)

      const cpp = ((cash - taxes) / points) * 100

      // Single soft fact for the failure message — the cpp we derived,
      // which dollar / point / tax values it came from, and the
      // threshold it's measured against.
      expect(
        cpp,
        `card ${i}: derived cpp = ${cpp.toFixed(2)} < ${USE_POINTS_STRONG_THRESHOLD}. ` +
          `cash=$${cash} points=${points} taxes=$${taxes}. ` +
          `Pre-fix this card would have failed (e.g., JFK→LHR Biz Qatar Avios = 1.36 cpp).`,
      ).toBeGreaterThanOrEqual(USE_POINTS_STRONG_THRESHOLD)
    }
  })

  test('card 0 anchor — SEA → PVG Business + Flying Blue (highest-cpp pin)', async ({
    page,
  }) => {
    // Anchor on the ordering choice so a SAVINGS_EXAMPLES reshuffle that
    // demotes the highest-cpp card off the top slot is caught here, not
    // silently shipped. Refresh this assertion if the card order moves
    // intentionally.
    await page.goto('/')
    const cards = page.locator('[data-testid="savings-example-card"]')
    await expect(cards.nth(0)).toContainText(/SEA\s*→\s*PVG/i)
    await expect(cards.nth(0)).toContainText(/Business/i)
    await expect(cards.nth(0)).toContainText(/Air France\/KLM Flying Blue/i)
  })
})
