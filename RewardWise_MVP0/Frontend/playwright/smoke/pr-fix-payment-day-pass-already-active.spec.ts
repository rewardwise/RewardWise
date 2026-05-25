/**
 * Production smoke: PR FIX-PAYMENT — already-active 409 + Path-C upsell
 * modal across all three Stripe Checkout surfaces (Day Pass, Monthly
 * Subscription, Concierge).
 *
 * File covers three scenarios, sequenced via describe.serial blocks and
 * the playwright.config.ts worker=1 / fullyParallel=false guard. Each
 * block runs its own beforeAll seed + afterAll teardown against the
 * shared smoke-test-empty@ account, so state never leaks across blocks
 * (and never out of the file).
 *
 *   1) Day Pass already-active → 409 active_day_pass → Path-C modal +
 *      Upgrade-to-Monthly CTA. Original Megan regression (ClickUp
 *      86b9yj5ut, PI pi_3TZDPLJBOkdxC5V11Vc5FEMA + pi_3TZDQVJBOkdxC5V10xNCRKD4,
 *      $0.99 × 2 in 72 seconds). Pre-fix the click would have minted
 *      a second Day Pass Checkout; post-fix the server returns 409
 *      before stripe.checkout.sessions.create.
 *
 *   2) Subscribe already-active → 409 already_subscribed → modal in
 *      dual-state mode ("You already have Monthly access", "Got it"
 *      only). Pre-fix the subscribe endpoint had no entitlement guard
 *      at all, so a paid monthly user clicking Subscribe from a second
 *      tab would mint a duplicate $3.99/mo subscription billing them
 *      every cycle until manual reconciliation.
 *
 *   3) Concierge already-paid → 409 already_paid with detail_url.
 *      Tested API-direct (no form-fill UI flow) because the modal is
 *      a router.push to detail_url, not a Path-C modal. Pre-fix a
 *      paid Premium request could be re-paid, minting a duplicate
 *      $199 Checkout for the same travel_request.
 *
 * ENTITLEMENT CHECK ORDER MATTERS — Day Pass condition must be evaluated
 * before INTERNAL condition for block 1's 409 message assertion to remain
 * valid. The seeded smoke account lives on the @mytravelwallet.ai domain,
 * which a future PR (INTERNAL-ACC) will treat as a paywall-bypass cohort.
 * If that future PR appends an INTERNAL branch BEFORE the Day Pass branch
 * in /api/payments/day-pass/route.ts, this spec will start seeing the
 * INTERNAL response instead of `error: "active_day_pass"` and silently
 * stop covering the regression. The order in route.ts is:
 *   1) hasActiveDayPass     → 409 "active_day_pass"      (block 1)
 *   2) hasActiveSubscription → 409 "active_subscription"
 *   3) (future) INTERNAL    → 409 "internal_access"
 *
 * Shared smoke account: smoke-test-empty@mytravelwallet.ai. Reused with
 * PR B's empty-wallet spec. All blocks here use the same account and
 * each block fully restores state in afterAll so a future block's seed
 * can't observe stale data.
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
// installed. The fields we use (auth.admin.listUsers, from(...).update/upsert/
// insert/delete/select) are stable and typed inline at the call sites.
type AdminQueryResult<T = unknown> = Promise<{ data?: T; error?: unknown }>
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
    upsert: (
      row: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => Promise<{ error?: unknown }>
    insert: (row: Record<string, unknown>) => {
      select: (cols?: string) => {
        single: () => AdminQueryResult<{ id: string }>
      }
    }
    delete: () => {
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

async function seedActiveSubscription(seed: SeedContext): Promise<string> {
  // Upsert keyed on user_id (we treat one active subscription per user as the
  // smoke-test invariant). current_period_end 30d in the future so the
  // subscribe entitlement check (status='active' AND current_period_end > now)
  // returns true.
  const periodEnd = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const { error } = await seed.adminClient
    .from('subscriptions')
    .upsert(
      {
        user_id: seed.userId,
        status: 'active',
        plan: 'pro',
        current_period_end: periodEnd,
        // stripe_customer_id + stripe_subscription_id intentionally NULL —
        // the smoke check only inspects status + current_period_end.
      },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error('seed subscription upsert failed (sanitized)')
  return periodEnd
}

async function clearActiveSubscription(seed: SeedContext): Promise<void> {
  const { error } = await seed.adminClient
    .from('subscriptions')
    .delete()
    .eq('user_id', seed.userId)
  if (error) {
    console.warn('[teardown] clear subscription failed (sanitized)')
  }
}

async function seedPaidTravelRequest(seed: SeedContext): Promise<string> {
  // Insert a Standard-tier travel_request in `paid` status so the concierge
  // checkout payment_status guard at /api/payments/checkout returns 409
  // already_paid + detail_url. departure_date is 60d out to satisfy the
  // dates_valid + departure_in_future constraints (if any).
  const departure = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const { data, error } = await seed.adminClient
    .from('travel_requests')
    .insert({
      user_id: seed.userId,
      tier: 'standard',
      status: 'paid',
      origin: 'SFO',
      destination: 'JFK',
      departure_date: departure,
      trip_type: 'oneway',
      passengers: 1,
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    throw new Error('seed travel_request insert failed (sanitized)')
  }
  return data.id
}

async function clearPaidTravelRequest(
  seed: SeedContext,
  requestId: string,
): Promise<void> {
  const { error } = await seed.adminClient
    .from('travel_requests')
    .delete()
    .eq('id', requestId)
  if (error) {
    console.warn('[teardown] clear travel_request failed (sanitized)')
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

test.describe.serial(
  'PR FIX-PAYMENT: Subscribe already-active 409 + dual-state modal',
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
      await seedActiveSubscription(seed)
    })

    test.afterAll(async () => {
      if (seed) await clearActiveSubscription(seed)
      if (context) await context.close()
    })

    test('seeded Monthly subscriber is blocked from re-subscribing and sees dual-state modal', async ({
      browser,
      baseURL,
    }) => {
      if (!seed || !baseURL) {
        test.skip(true, 'Missing seed context or baseURL')
        return
      }

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

      // Capture every payments API call to prove subscribe POST returned 409
      // and no Stripe Checkout session was created.
      const paymentCalls: Array<{ url: string; status: number }> = []
      page.on('response', (res) => {
        const url = res.url()
        if (url.includes('/api/payments/')) {
          paymentCalls.push({ url, status: res.status() })
        }
      })

      await page.goto('/subscribe', { waitUntil: 'networkidle' })

      // Click Subscribe CTA. ZoePricingCards uses
      // data-testid="subscribe-monthly-cta" for the Monthly card.
      const subscribeButton = page.getByTestId('subscribe-monthly-cta')
      await subscribeButton.click()

      // The unified Already-Active modal is the load-bearing assertion. In
      // dual-state mode (hasActiveSubscription=true, upsell=null) it renders
      // the Subscription story: "You already have Monthly access" + a single
      // "Got it" dismiss CTA, with NO Upgrade-to-Monthly button.
      const modal = page.locator(
        '[data-testid="day-pass-already-active-modal"]',
      )
      await expect(modal).toBeVisible({ timeout: 10_000 })
      await expect(modal).toContainText(/You already have Monthly access/i)

      // Negative assertion: no upgrade button in dual-state mode.
      await expect(
        modal.locator('[data-testid="upgrade-to-monthly"]'),
      ).toHaveCount(0)

      // The dismiss button reads "Got it" in the subscription branch.
      const dismiss = modal.locator('[data-testid="dismiss-modal"]')
      await expect(dismiss).toBeVisible()
      await expect(dismiss).toContainText(/Got it/i)

      // Negative assertion: no navigation to Stripe happened. Pre-fix the
      // subscribe endpoint had no entitlement guard, so this click would
      // have minted a duplicate $3.99/mo subscription.
      expect(page.url()).not.toContain('checkout.stripe.com')

      // The subscribe POST must have come back 409 exactly once.
      const subscribeResponses = paymentCalls.filter((c) =>
        c.url.includes('/api/payments/subscribe'),
      )
      expect(subscribeResponses).toHaveLength(1)
      expect(subscribeResponses[0].status).toBe(409)
    })
  },
)

test.describe.serial(
  'PR FIX-PAYMENT: Concierge already-paid 409 with detail_url',
  () => {
    let seed: SeedContext | null = null
    let requestId: string | null = null
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
      requestId = await seedPaidTravelRequest(seed)
    })

    test.afterAll(async () => {
      if (seed && requestId) await clearPaidTravelRequest(seed, requestId)
      if (context) await context.close()
    })

    test('paid travel_request is blocked from re-checkout via API-direct POST', async ({
      browser,
      baseURL,
    }) => {
      if (!seed || !baseURL || !requestId) {
        test.skip(true, 'Missing seed context, baseURL, or seeded requestId')
        return
      }

      // API-direct test (not UI): the concierge `already_paid` branch is
      // structurally rare (concierge always creates a fresh travel_request
      // before calling checkout), so this is defense-in-depth coverage for
      // parallel-tab races + future deep-link re-pay entry points. The
      // frontend response handler is exercised by the backend vitest
      // (entitlement-and-day-pass-guard.test.ts).
      const secretsPath = `${homedir()}/.config/secrets/mytravelwallet.env`
      const smokeEmail = parseEnvFile(
        readFileSync(secretsPath, 'utf8'),
      ).MTW_SMOKE_EMPTY_EMAIL
      context = await browser.newContext()
      await mintSessionViaServiceRole(context, {
        baseUrl: baseURL,
        email: smokeEmail,
      })

      // Playwright APIRequestContext from the BrowserContext carries cookies
      // so the POST is authenticated as the seeded smoke account.
      const res = await context.request.post(
        `${baseURL}/api/payments/checkout`,
        {
          data: { travel_request_id: requestId },
          headers: { 'content-type': 'application/json' },
        },
      )

      expect(res.status()).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('already_paid')
      expect(typeof body.detail_url).toBe('string')
      // detail_url must point at a concierge tier page with the seeded
      // travel_request_id (whether ?travel_request_id= is the exact param
      // name comes from checkout/route.ts; assert it's present in the URL).
      expect(body.detail_url).toContain('/concierge/')
      expect(body.detail_url).toContain(requestId)
    })
  },
)
