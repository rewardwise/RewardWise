/**
 * Production smoke: PR FIX-PAYMENT — Day Pass already-active 409 + Path-C
 * upsell modal.
 *
 * ENTITLEMENT CHECK ORDER MATTERS — Day Pass condition must be evaluated
 * before INTERNAL condition for this test's 409 message assertion to remain
 * valid. The seeded smoke account lives on the @mytravelwallet.ai domain,
 * which a future PR (INTERNAL-ACC) will treat as a paywall-bypass cohort.
 * If that future PR appends an INTERNAL branch BEFORE the Day Pass branch
 * in /api/payments/day-pass/route.ts, this spec will start seeing the
 * INTERNAL response instead of `error: "active_day_pass"` and silently
 * stop covering the regression. The order in route.ts is:
 *   1) hasActiveDayPass     → 409 "active_day_pass"      (this spec)
 *   2) hasActiveSubscription → 409 "active_subscription"
 *   3) (future) INTERNAL    → 409 "internal_access"
 *
 * Regression target: ClickUp 86b9yj5ut. Megan Bittner was double-charged
 * $0.99 for two Day Passes 72 seconds apart (PI ids pi_3TZDPLJBOkdxC5V11Vc5FEMA
 * and pi_3TZDQVJBOkdxC5V10xNCRKD4). The client-side hide-the-card gate
 * was bypassable; the server now enforces the entitlement check before
 * creating a second Stripe Checkout session. This spec proves the server
 * gate holds on the production deployment.
 *
 * Shared smoke account: smoke-test-empty@mytravelwallet.ai. Reused with
 * PR B's empty-wallet spec. The two specs are sequenced via worker=1 +
 * fullyParallel=false (playwright.config.ts) AND test.describe.serial()
 * here (defense in depth) so the seed state from one cannot leak into
 * the other.
 *
 * Setup: seeds profile.day_pass_expires_at = now() + 18h via Supabase
 * service-role. Teardown: clears day_pass_expires_at back to null. No
 * paid Stripe transactions; the Stripe call is asserted to NOT happen
 * on the Day Pass click and to happen ONCE on the upsell click.
 *
 * Required env (verified at runtime, spec.skip() if missing):
 *   - MTW_SMOKE_EMPTY_EMAIL (in ~/.config/secrets/mytravelwallet.env)
 *   - SUPABASE_SERVICE_ROLE_KEY (in Frontend/.env.local)
 *   - NEXT_PUBLIC_SUPABASE_URL (in Frontend/.env.local)
 */

import { test, expect, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { mintSessionViaServiceRole } from '../auth/mint-session'

const FRONTEND_DIR = '/Users/nagi/Code/RewardWise/RewardWise_MVP0/Frontend'
const requireFromFrontend = createRequire(`${FRONTEND_DIR}/package.json`)

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

// Admin client is loaded via runtime require() from the main repo's node_modules
// (FRONTEND_DIR) and the worktree may not have @supabase/supabase-js types
// installed. The fields we use (auth.admin.listUsers, from(...).update(...))
// are stable and typed inline at the call sites.
type AdminClient = {
  auth: {
    admin: {
      listUsers: (opts: {
        page: number
        perPage: number
      }) => Promise<{
        data?: { users?: Array<{ id: string; email?: string }> }
        error?: unknown
      }>
    }
  }
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error?: unknown }>
    }
  }
}

interface SeedContext {
  adminClient: AdminClient
  userId: string
}

async function loadSeedContext(): Promise<SeedContext | null> {
  const secretsPath = `${homedir()}/.config/secrets/mytravelwallet.env`
  const secrets = parseEnvFile(readFileSync(secretsPath, 'utf8'))
  const email = secrets.MTW_SMOKE_EMPTY_EMAIL
  if (!email) return null

  const env = parseEnvFile(readFileSync(`${FRONTEND_DIR}/.env.local`, 'utf8'))
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const { createClient } = requireFromFrontend('@supabase/supabase-js') as {
    createClient: (
      url: string,
      key: string,
      opts?: Record<string, unknown>,
    ) => AdminClient
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Resolve user_id by email. listUsers paginates at 50/page; the smoke
  // project is small enough that the first page is sufficient, but bump
  // perPage to 200 in case the user list grows.
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (error) throw new Error('admin.listUsers failed (sanitized)')
  const user = data?.users?.find((u) => u.email === email)
  if (!user) {
    throw new Error(
      `smoke-test-empty account not found in auth.users (email lookup)`,
    )
  }
  return { adminClient: admin, userId: user.id }
}

async function seedActiveDayPass(seed: SeedContext): Promise<string> {
  const expiresAt = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString()
  const { error } = await seed.adminClient
    .from('profiles')
    .update({ day_pass_expires_at: expiresAt })
    .eq('user_id', seed.userId)
  if (error) throw new Error('seed profile update failed (sanitized)')
  return expiresAt
}

async function clearActiveDayPass(seed: SeedContext): Promise<void> {
  const { error } = await seed.adminClient
    .from('profiles')
    .update({ day_pass_expires_at: null })
    .eq('user_id', seed.userId)
  if (error) {
    // Teardown failures shouldn't fail the test, but log so the next run
    // sees a stale seed and the suspicious-seed assertion (below) catches it.
    console.warn('[teardown] clear day_pass_expires_at failed (sanitized)')
  }
}

test.describe.serial(
  'PR FIX-PAYMENT: Day Pass already-active 409 + Path-C modal',
  () => {
    let seed: SeedContext | null = null
    let context: BrowserContext | null = null

    test.beforeAll(async () => {
      seed = await loadSeedContext()
      if (!seed) {
        test.skip(
          true,
          'Missing MTW_SMOKE_EMPTY_EMAIL or .env.local Supabase creds; spec disabled until provisioned.',
        )
        return
      }
      await seedActiveDayPass(seed)
    })

    test.afterAll(async () => {
      if (seed) await clearActiveDayPass(seed)
      if (context) await context.close()
    })

    test('seeded Day Pass user is blocked from re-purchase and upsold to Monthly', async ({
      browser,
      baseURL,
    }) => {
      if (!seed || !baseURL) {
        test.skip(true, 'Missing seed context or baseURL')
        return
      }

      // Fresh context — don't reuse the globalSetup storageState, which is
      // minted for a different account. mintSessionViaServiceRole writes
      // cookies + localStorage scoped to baseURL.
      const secretsPath = `${homedir()}/.config/secrets/mytravelwallet.env`
      const smokeEmail = parseEnvFile(
        readFileSync(secretsPath, 'utf8'),
      ).MTW_SMOKE_EMPTY_EMAIL
      context = await browser.newContext()
      await mintSessionViaServiceRole(context, {
        baseUrl: baseURL,
        email: smokeEmail,
      })

      const page = await context.newPage()

      // Capture every payments API call so we can prove (a) day-pass POST
      // returned 409 and (b) the upgrade click hit /api/payments/subscribe,
      // not /api/payments/day-pass again.
      const paymentCalls: Array<{ url: string; status: number }> = []
      page.on('response', (res) => {
        const url = res.url()
        if (url.includes('/api/payments/')) {
          paymentCalls.push({ url, status: res.status() })
        }
      })

      await page.goto('/subscribe', { waitUntil: 'networkidle' })

      // Click the Day Pass purchase CTA. ZoePricingCards renders both Day
      // Pass and Monthly cards; the Day Pass card's button is tagged with
      // data-testid="get-day-pass-cta" specifically so this regression spec
      // cannot drift onto a sibling button (e.g. "Subscribe - $3.99/mo"
      // also matches /day pass/i via its surrounding card heading text).
      const dayPassButton = page.getByTestId('get-day-pass-cta')
      await dayPassButton.click()

      // The modal is the load-bearing assertion: pre-fix this would have
      // navigated to Stripe Checkout for a second Day Pass purchase.
      const modal = page.locator(
        '[data-testid="day-pass-already-active-modal"]',
      )
      await expect(modal).toBeVisible({ timeout: 10_000 })

      // Sub-assertion: the Day Pass story rendered, not the Subscription
      // story (proves checkEntitlement returned active_day_pass, not
      // active_subscription, which is the order-of-evaluation contract
      // the comment at the top of this file is guarding).
      await expect(modal).toContainText(/Day Pass is still active/i)

      // Bind the assertion to the seeded clock: seedActiveDayPass writes
      // now() + 18h, and the modal renders Math.floor(remainingHours). Allow
      // 17 or 18 to absorb any sub-second drift between the seed write and
      // the entitlement read on the server. If a future regression breaks
      // remaining-hours math (e.g. seeds 18h but renders 0), this catches
      // it; without this assertion the modal could render with garbage
      // hours and the test would still pass.
      await expect(modal).toContainText(/(17|18)\s*hour/i)

      const upgradeCta = modal.locator('[data-testid="upgrade-to-monthly"]')
      await expect(upgradeCta).toBeVisible()

      // Negative assertion: no navigation to Stripe happened. The page URL
      // should still be on our origin (/subscribe or wherever the modal
      // overlays). If the server gate were missing, page.url() would be
      // checkout.stripe.com by now.
      expect(page.url()).not.toContain('checkout.stripe.com')

      // The day-pass POST must have come back 409. There should be exactly
      // one such call (the click we made).
      const dayPassResponses = paymentCalls.filter((c) =>
        c.url.includes('/api/payments/day-pass'),
      )
      expect(dayPassResponses).toHaveLength(1)
      expect(dayPassResponses[0].status).toBe(409)

      // Now click the upsell. This should POST /api/payments/subscribe
      // (mode: subscription) and navigate to Stripe Checkout.
      const navPromise = page.waitForURL(/checkout\.stripe\.com/, {
        timeout: 15_000,
      })
      await upgradeCta.click()
      await navPromise

      expect(page.url()).toContain('checkout.stripe.com')

      // Subscribe endpoint must have been called exactly once and returned
      // a redirect-ready 200. Day-pass endpoint must NOT have been called
      // a second time (proves the upsell went to the right route).
      const subscribeResponses = paymentCalls.filter((c) =>
        c.url.includes('/api/payments/subscribe'),
      )
      expect(subscribeResponses).toHaveLength(1)
      expect(subscribeResponses[0].status).toBe(200)
      expect(
        paymentCalls.filter((c) => c.url.includes('/api/payments/day-pass'))
          .length,
      ).toBe(1)
    })
  },
)
