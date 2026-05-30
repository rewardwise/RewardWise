/**
 * Production smoke: PR #170 — Anna's testimonial anchors on Avianca LifeMiles.
 *
 * Backstory: the verdict gate was rescoped from per-pax/per-leg winner.cpp to
 * matched-scope total-trip cpp. Under the new (correct) gate, Anna's SEA→PVG
 * econ × 4 RT at the typical ANA-via-partner rate (35k each way through Virgin
 * Atlantic / Aeroplan) lands at matched_cpp ≈ 1.28 cents per point — i.e.
 * pay_cash gray zone. That would put the testimonial out of sync with the
 * product, which violates the "marketing must match the corrected product"
 * principle.
 *
 * Pinning the testimonial to Avianca LifeMiles fixes the inconsistency:
 * LifeMiles is the ANA partner with no fuel surcharges and a 25k each-way
 * partner rate, which lands at matched_cpp ≈ 1.87 cents per point → use_points
 * strong. The product and the marketing now describe the same redemption.
 *
 * Pre-fix surface (live on www.mytravelwallet.ai as of 2026-05-30):
 *   Anna's quote: "Flying our family of four from Seattle to Shanghai this
 *   summer, it saved us about $3,600 — and found the deal in seconds. I could
 *   never have pulled that together on my own."
 *
 * Post-fix UI contract:
 *   Anna's quote: "It found us ANA economy seats through Avianca LifeMiles for
 *   our family of four to Shanghai this summer — saved about $3,600 in
 *   seconds. I never would have thought to check that partner program on my
 *   own."
 *
 * Viewport scope: the testimonials section renders identical text content at
 * 1440 and 375 (responsive layout, same DOM). One spec covers both viewports
 * via playwright projects.
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

  test('Anna quote names Avianca LifeMiles + ANA in DOM', async ({ page }) => {
    await page.goto('/')

    // Anchor on the landing page rendering at all.
    await expect(page.locator('[data-testid="hero-h1"]')).toBeVisible()

    // Post-fix copy must be present. Use partial-text matchers so the
    // assertion survives small editorial tweaks to the surrounding quote
    // while still pinning the load-bearing program-name anchor.
    await expect(
      page.getByText(/Avianca LifeMiles/i).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/ANA economy seats through Avianca LifeMiles/i),
    ).toHaveCount(1)

    // Pre-fix copy MUST NOT appear (this is the falsifying assertion).
    await expect(
      page.getByText(/found the deal in seconds\. I could never have pulled/i),
    ).toHaveCount(0)
  })
})
