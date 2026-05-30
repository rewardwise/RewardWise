/**
 * Production smoke: PR #170 + follow-up — Anna's testimonial anchors on
 * Avianca LifeMiles only, with no unconfirmed operating carrier claim.
 *
 * Backstory: the verdict gate was rescoped from per-pax/per-leg winner.cpp
 * to matched-scope total-trip cpp. Anna's confirmed real booking is
 * SEA→PVG economy × 4 RT redeemed through Avianca LifeMiles, saving about
 * $3,600. The LifeMiles program name is confirmed. The operating carrier
 * (ANA vs. other Star Alliance partners) is NOT confirmed, so the quote
 * does not name a carrier.
 *
 * Honest math note for future-us, not asserted in DOM:
 *   At ~35k miles each way × 4 pax × 2 legs = 280k miles, $3,600 savings
 *   gives matched_cpp ≈ 1.29 cents per point. Under the rescoped gate that
 *   lands in the gray pay_cash zone, not premium use_points. The
 *   testimonial is honest about Anna's actual outcome ($3,600 saved) and
 *   does NOT make a tier or "best move" claim, so it stays consistent with
 *   the product's verdict regardless of where this redemption classifies.
 *
 * Pre-fix surface (live on www.mytravelwallet.ai as of 2026-05-30):
 *   Anna's quote: "Flying our family of four from Seattle to Shanghai this
 *   summer, it saved us about $3,600 — and found the deal in seconds. I
 *   could never have pulled that together on my own."
 *
 * Post-fix UI contract:
 *   Anna's quote: "It found us economy seats through Avianca LifeMiles for
 *   our family of four to Shanghai this summer — saved about $3,600 in
 *   seconds. I never would have thought to check that partner program on
 *   my own."
 *
 * Viewport scope: the testimonials section renders identical text content
 * at 1440 and 375 (responsive layout, same DOM). One spec covers both
 * viewports via playwright projects.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getVercelBypassHeader } from '../auth/vercel-bypass'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR #170: Anna testimonial anchors on Avianca LifeMiles', () => {
  test.beforeEach(async ({ context }) => {
    const syntheticIp = `smoke-pr170-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
      ...getVercelBypassHeader(),
    })
  })

  test('Anna quote names Avianca LifeMiles in DOM, no carrier claim', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="hero-h1"]')).toBeVisible()

    await expect(
      page.getByText(/Avianca LifeMiles/i).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/economy seats through Avianca LifeMiles/i),
    ).toHaveCount(1)

    // Pre-fix copy MUST NOT appear (original pre-LifeMiles testimonial).
    await expect(
      page.getByText(/found the deal in seconds\. I could never have pulled/i),
    ).toHaveCount(0)

    // Falsifying assertion: the unconfirmed-carrier phrasing must be gone.
    await expect(
      page.getByText(/ANA economy seats/i),
    ).toHaveCount(0)
  })
})
