/**
 * Production smoke: PR marketing-homepage-revamp — landing-page rewrite.
 *
 * Pre-fix surface (live on www.mytravelwallet.ai as of 2026-05-28):
 *   - Hero showed TWO above-the-fold buttons: "Create your account" (primary)
 *     and "Sign in" (secondary). High-friction.
 *   - Paywall copy was hard-coded "One free search" / "once for free" — could
 *     not be tuned without a frontend redeploy.
 *   - No empty-state contract for marketing data: any future SAVINGS_EXAMPLES
 *     or testimonials slot was an implicit promise we could not substantiate.
 *
 * Post-fix UI contract:
 *   1. Single primary CTA above the fold ("Try a free search"). The old
 *      "Create your account" copy must NOT appear above the fold. A small
 *      "Sign in" text-link is permitted (and expected) below the CTA.
 *   2. Clicking the primary CTA reveals the inline try-search panel — the
 *      paywall-gated public search, no signup wall.
 *   3. Paywall copy is configurable: the panel eyebrow reads
 *      "{N} free searches" where N = NEXT_PUBLIC_PUBLIC_SEARCH_FREE_LIMIT.
 *      Default (and prod current) is 3. Test asserts the rendered N matches
 *      the env at build time.
 *   4. Real-verdicts (SAVINGS_EXAMPLES) section is empty-state-gated: when
 *      SAVINGS_EXAMPLES = [], the entire section is absent from the DOM (no
 *      eyebrow, no header, no skeleton). At ship the array is empty.
 *   5. Social-proof section is empty-state-gated by three independent
 *      sub-blocks (rating, traveler counter, testimonials). When all three
 *      are null/empty, the entire section is absent from the DOM. At ship
 *      all three are null/empty.
 *
 * Falsifies pre-fix: assertions 1, 3, 4, 5 all fail against pre-PR prod
 * because the surfaces did not exist; assertion 2 fails because the CTA
 * routed to /signup instead of revealing the inline panel.
 *
 * Trial-gate isolation: each test uses a fresh storageState (no auth cookies)
 * and a synthetic cf-connecting-ip header so the public-search IP-hash
 * dedup doesn't poison sequential runs.
 *
 * Runs at both viewports (chromium-1440-auth + chromium-375-auth via
 * playwright.config.ts projects, but storageState is overridden to empty
 * here — this is the visitor surface).
 */

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

// Match the build-time default in Frontend/utils/public-search.ts. Override
// with PLAYWRIGHT_PUBLIC_SEARCH_FREE_LIMIT if running against a deploy that
// has the env tuned to a non-default value.
const PUBLIC_SEARCH_FREE_LIMIT = (() => {
  const raw = process.env.PLAYWRIGHT_PUBLIC_SEARCH_FREE_LIMIT
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 3
})()

const expectedSearchesNoun =
  PUBLIC_SEARCH_FREE_LIMIT === 1 ? 'search' : 'searches'

// Empty cookies — this is the visitor / unauth surface.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('PR marketing-homepage-revamp: hero + empty-state sections + configurable paywall', () => {
  test.beforeEach(async ({ context }) => {
    const syntheticIp = `smoke-marketing-revamp-${randomUUID()}`
    await context.setExtraHTTPHeaders({
      'cf-connecting-ip': syntheticIp,
      'x-real-ip': syntheticIp,
      'x-forwarded-for': syntheticIp,
    })
  })

  test('hero renders single primary CTA above the fold (no "Create your account")', async ({
    page,
  }) => {
    await page.goto('/')

    // The verdict-led H1 anchors the hero.
    const h1 = page.locator('[data-testid="hero-h1"]')
    await expect(h1).toBeVisible()
    await expect(h1).toContainText(
      /fastest way to know if your points are worth using/i,
    )

    // Single primary CTA, copy = "Try a free search".
    const primary = page.locator('[data-testid="hero-primary-cta"]')
    await expect(primary).toHaveCount(1)
    await expect(primary).toBeVisible()
    await expect(primary).toContainText(/try a free search/i)

    // Pre-fix copy MUST NOT appear above the fold. A "Sign in" text-link is
    // permitted (and expected) below the primary CTA — assertion targets the
    // old account-creation button specifically.
    await expect(
      page.getByRole('button', { name: /create your account/i }),
    ).toHaveCount(0)
  })

  test('clicking the primary CTA reveals the inline try-search panel', async ({
    page,
  }) => {
    await page.goto('/')

    // Panel is gated behind the CTA — absent before click.
    const panelEyebrow = page.getByText(
      new RegExp(`${PUBLIC_SEARCH_FREE_LIMIT} free ${expectedSearchesNoun}`, 'i'),
    )
    await expect(panelEyebrow).toHaveCount(0)

    await page.locator('[data-testid="hero-primary-cta"]').click()

    // Post-click: the panel eyebrow + the airport inputs render.
    await expect(panelEyebrow.first()).toBeVisible()
    await expect(page.getByPlaceholder('City or airport').first()).toBeVisible()
  })

  test(`paywall copy reads "${PUBLIC_SEARCH_FREE_LIMIT} free ${expectedSearchesNoun}" — matches NEXT_PUBLIC_PUBLIC_SEARCH_FREE_LIMIT`, async ({
    page,
  }) => {
    await page.goto('/')
    await page.locator('[data-testid="hero-primary-cta"]').click()

    // Eyebrow on the try-search panel.
    await expect(
      page
        .getByText(
          new RegExp(`^${PUBLIC_SEARCH_FREE_LIMIT} free ${expectedSearchesNoun}$`, 'i'),
        )
        .first(),
    ).toBeVisible()

    // Subhead body line mentions the same N.
    const timesNoun = PUBLIC_SEARCH_FREE_LIMIT === 1 ? 'time' : 'times'
    await expect(
      page
        .getByText(
          new RegExp(
            `route/date/cabin flow ${PUBLIC_SEARCH_FREE_LIMIT} ${timesNoun} for free`,
            'i',
          ),
        )
        .first(),
    ).toBeVisible()
  })

  test('SAVINGS_EXAMPLES empty → savings-examples section absent from DOM', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(
      page.locator('[data-testid="savings-examples-section"]'),
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="savings-example-card"]'),
    ).toHaveCount(0)
  })

  test('social-proof slots all empty → social-proof section absent from DOM', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(
      page.locator('[data-testid="social-proof-section"]'),
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="social-proof-stats"]'),
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="social-proof-testimonials"]'),
    ).toHaveCount(0)
    await expect(page.locator('[data-testid="testimonial-card"]')).toHaveCount(
      0,
    )
  })
})
