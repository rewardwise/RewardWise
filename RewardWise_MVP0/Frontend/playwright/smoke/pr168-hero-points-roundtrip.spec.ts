/**
 * Production smoke: PR #168 — hero Points tile shows real round-trip total.
 *
 * Pre-fix surface (live on www.mytravelwallet.ai as of 2026-05-30, shipped
 * by PR #166):
 *   HERO_EXAMPLE.pointsCost = 237,000  → rendered as "237k pts"
 *   per-traveler caption                → rendered as "79k pts each"
 *
 * Both figures are wrong on the real seats.aero data: the API returns
 * SEPARATE outbound + return award objects, each carrying its own 79,000
 * points (one-way per pax). For an SFO↔SIN PE round trip × 3 travelers the
 * true total is (79,000 + 79,000) × 3 = 474,000 pts and the per-pax round-
 * trip total is 158,000 each.
 *
 * Post-fix UI contract:
 *   - "Points" tile big number renders "474k pts"
 *   - per-traveler caption renders "158k pts each"
 *   - Old "237k pts" / "79k pts each" must NOT appear anywhere on the page
 *
 * Viewport scope: HERO_EXAMPLE is a static constant that React renders into
 * the DOM identically at every viewport. The right-column card is CSS-hidden
 * below the `lg` breakpoint (`hidden lg:flex`, display:none < 1024px), but
 * its text content is still present in the DOM. So the same text-content
 * assertions hold at both 1440 and 375 — only the *visual* presence of the
 * tile differs, and we don't need to assert on that to lock in the unit-fix.
 *
 * Falsifies pre-fix: locator for "474k pts" returns 0 on prod today (live
 * hero renders "237k pts"); test fails. Post-merge, prod flips to "474k pts"
 * and the spec passes. Negative assertions catch the inverse regression.
 *
 * Trial-gate isolation: fresh storageState + synthetic IP headers so the
 * public-search dedup doesn't interfere across runs. Mirrors the pattern in
 * pr-marketing-homepage-revamp.spec.ts.
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getVercelBypassHeader } from '../auth/vercel-bypass'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR #168: hero Points tile = real RT total (474k), not one-way × travelers (237k)', () => {
  test.beforeEach(async ({ context }) => {
    const syntheticIp = `smoke-pr168-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
      ...getVercelBypassHeader(),
    })
  })

  test('Points tile renders 474k pts + 158k pts each in DOM (both viewports)', async ({
    page,
  }) => {
    await page.goto('/')

    // Anchor on the hero so we know HERO_EXAMPLE rendered at all.
    await expect(page.locator('[data-testid="hero-h1"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="hero-savings-anchor"]'),
    ).toBeVisible()

    // HERO_EXAMPLE renders into the DOM identically at every viewport — the
    // right-column card is CSS-hidden (`hidden lg:flex`) below 1024px, but
    // its text content is still present in the DOM. So `getByText` matches
    // the same set of strings at both 1440 and 375; only visual presence
    // differs, which we don't need to lock down for this unit-fix.
    await expect(page.getByText(/^474k pts$/)).toHaveCount(1)
    await expect(page.getByText(/^158k pts each$/)).toHaveCount(1)

    // Pre-fix values MUST NOT appear anywhere on the page (the live hero
    // surface today renders these; this is the falsifying assertion).
    await expect(page.getByText(/^237k pts$/)).toHaveCount(0)
    await expect(page.getByText(/^79k pts each$/)).toHaveCount(0)
  })
})
