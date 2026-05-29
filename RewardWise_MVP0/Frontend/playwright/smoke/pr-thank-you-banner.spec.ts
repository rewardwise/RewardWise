/**
 * Production smoke: PR THANK-YOU — /subscribe banner renders for allowlisted
 * thank-you emails and is ABSENT for non-allowlisted controls.
 *
 * Coverage:
 *   1) Positive: log in as MTW_THANK_YOU_TEST_EMAIL (this email is also in
 *      Vercel's THANK_YOU_EMAILS) → navigate to /subscribe → assert
 *      data-testid="thank-you-banner" is visible AND contains the campaign
 *      copy. Pre-fix the banner did not exist; post-fix it renders for
 *      every allowlisted email reaching the normal-flow branch.
 *
 *   2) Control: log in as MTW_CONTROL_TEST_EMAIL (NOT in THANK_YOU_EMAILS)
 *      → navigate to /subscribe → assert banner is ABSENT. Guards against a
 *      regression where the banner renders for everyone (e.g. server-side
 *      gating drift, allowlist parsing bug, or accidental "always-true"
 *      prop default in SubscribeClient).
 *
 * HARD REQUIREMENT — both fixture accounts MUST be non-internal. The banner
 * only renders on the normal-flow return branch of SubscribeClient; an
 * INTERNAL_EMAILS account hits the isInternal branch and never reaches it.
 * Reusing smoke-test-empty@mytravelwallet.ai (the existing fixture) would
 * make both assertions pass for the wrong reason — false confidence. Both
 * MTW_THANK_YOU_TEST_EMAIL and MTW_CONTROL_TEST_EMAIL must be:
 *   - real prod auth.users rows reachable via service-role admin
 *   - NOT in Vercel's INTERNAL_EMAILS (server) or NEXT_PUBLIC_INTERNAL_EMAILS
 *
 * Required env (verified at runtime, spec.skip() if missing):
 *   - MTW_THANK_YOU_TEST_EMAIL (in ~/.config/secrets/mytravelwallet.env)
 *   - MTW_CONTROL_TEST_EMAIL (in ~/.config/secrets/mytravelwallet.env)
 *   - SUPABASE_SERVICE_ROLE_KEY (in Frontend/.env.local — used by mint-session)
 *   - NEXT_PUBLIC_SUPABASE_URL (in Frontend/.env.local — used by mint-session)
 *   - Vercel env THANK_YOU_EMAILS must include MTW_THANK_YOU_TEST_EMAIL
 */

import { test, expect, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { mintSessionViaServiceRole } from '../auth/mint-session'

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

function loadSecrets() {
  const secretsPath = `${homedir()}/.config/secrets/mytravelwallet.env`
  try {
    return parseEnvFile(readFileSync(secretsPath, 'utf8'))
  } catch {
    return {}
  }
}

const BANNER_COPY_FRAGMENT = /first 2 months are free/i

test.describe.serial('PR THANK-YOU: /subscribe banner allowlist gating', () => {
  let context: BrowserContext | null = null

  test.afterEach(async () => {
    if (context) {
      await context.close()
      context = null
    }
  })

  test('allowlisted user sees the thank-you banner on /subscribe', async ({
    browser,
    baseURL,
  }) => {
    const secrets = loadSecrets()
    const email = secrets.MTW_THANK_YOU_TEST_EMAIL
    if (!email || !baseURL) {
      test.skip(
        true,
        'Missing MTW_THANK_YOU_TEST_EMAIL or baseURL; spec disabled until provisioned.',
      )
      return
    }

    context = await browser.newContext()
    await mintSessionViaServiceRole(context, { baseUrl: baseURL, email })

    const page = await context.newPage()
    await page.goto('/subscribe', { waitUntil: 'networkidle' })

    // Sub-assertion: confirm we are on the normal-flow branch (Monthly CTA
    // visible). If the test account were accidentally on INTERNAL_EMAILS,
    // the page would render the "Internal account" branch and the banner
    // would be absent — but for the wrong reason. Asserting the Monthly
    // CTA is present pins the test to the correct branch.
    const monthlyCta = page.getByTestId('subscribe-monthly-cta')
    await expect(monthlyCta).toBeVisible({ timeout: 10_000 })

    const banner = page.getByTestId('thank-you-banner')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    await expect(banner).toContainText(BANNER_COPY_FRAGMENT)
  })

  test('non-allowlisted control user does NOT see the thank-you banner', async ({
    browser,
    baseURL,
  }) => {
    const secrets = loadSecrets()
    const email = secrets.MTW_CONTROL_TEST_EMAIL
    if (!email || !baseURL) {
      test.skip(
        true,
        'Missing MTW_CONTROL_TEST_EMAIL or baseURL; spec disabled until provisioned.',
      )
      return
    }

    context = await browser.newContext()
    await mintSessionViaServiceRole(context, { baseUrl: baseURL, email })

    const page = await context.newPage()
    await page.goto('/subscribe', { waitUntil: 'networkidle' })

    // Same sub-assertion as positive: ensure we're on the normal-flow
    // branch (Monthly CTA visible). Without this, a control account that
    // accidentally landed on INTERNAL_EMAILS would also pass "banner
    // absent" — for the wrong reason.
    const monthlyCta = page.getByTestId('subscribe-monthly-cta')
    await expect(monthlyCta).toBeVisible({ timeout: 10_000 })

    const banner = page.getByTestId('thank-you-banner')
    await expect(banner).toHaveCount(0)
  })
})
