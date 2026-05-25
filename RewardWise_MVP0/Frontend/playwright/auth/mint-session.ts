/**
 * Playwright auth fixture: mints a Supabase session via the service-role
 * admin path and injects it as cookies + localStorage on a BrowserContext.
 *
 * Extracted from Tools/mobile_screenshot_capture.ts (May 6 2026 redaction
 * pass). The patterns below marked SECURITY-DEFENSE are intentional and
 * must not be removed during refactors:
 *
 *   1. Service-role key is read into a function-local, used once to build
 *      the admin client, then dropped to undefined before the test ever
 *      navigates. Keeps the key out of scope while user-controlled JS may
 *      run in page contexts.
 *   2. All error throws use sanitized strings (e.g. "verifyOtp failed
 *      (sanitized)"). Raw Supabase errors can leak request IDs or tokens.
 *   3. redactUrl() strips fragment + query from any URL that surfaces in
 *      logs or messages. The /auth/callback URL carries access_token in
 *      its fragment when magic links are clicked — never let that string
 *      reach stdout, even for "debug" prints.
 *   4. Cookies are scoped to the supplied baseUrl only; no wildcard domains.
 *   5. The --test smoke run from the original script (Tools/mobile_screenshot_capture.ts)
 *      asserts redactUrl() catches token-bearing URLs. If you change the
 *      redactor here, re-run that smoke test.
 */

import type { BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { getVercelBypassHeader } from './vercel-bypass'

// Hard-coded path to the main repo's Frontend so this fixture resolves the
// project's @supabase/* packages even when invoked from a sibling worktree
// that lacks its own node_modules. Same pattern as the script this was
// extracted from.
const FRONTEND_DIR = '/Users/nagi/Code/RewardWise/RewardWise_MVP0/Frontend'
const requireFromFrontend = createRequire(`${FRONTEND_DIR}/package.json`)

const HOME = homedir()
const SECRETS_PATH = `${HOME}/.config/secrets/mytravelwallet.env`

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

/**
 * SECURITY-DEFENSE: strip query string and fragment from a URL before it
 * surfaces in any log, error message, or thrown exception. Supabase
 * /auth/callback URLs carry access_token + refresh_token in the fragment;
 * any URL that touches stdout must pass through here first.
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return '[unparseable]'
  }
}

/**
 * Encode a Supabase SSR auth cookie value the way @supabase/ssr does when
 * cookieEncoding === 'base64url' (the default for createBrowserClient).
 * The value the server middleware decodes is `base64-<base64url(JSON)>`.
 */
function encodeSupabaseSsrCookie(payload: unknown): string {
  const json = JSON.stringify(payload)
  const b64 = Buffer.from(json, 'utf8').toString('base64')
  const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `base64-${b64url}`
}

export interface MintOptions {
  /** Origin the session cookies will be scoped to (e.g. http://localhost:3000). */
  baseUrl: string
  /**
   * Override the email looked up from secrets. When provided, takes precedence
   * over MTW_SMOKE_EMAIL / MTW_TEST_EMAIL. Used by smoke specs that need a
   * specific seeded account (e.g. the shared smoke-test-empty@ account that
   * PR B and PR FIX-PAYMENT both target) without forking globalSetup.
   */
  email?: string
}

export interface MintResult {
  /** Pathname after the post-auth reload settles. Useful for the proof test. */
  landedPath: string
}

/**
 * Mint a Supabase session purely server-side via verifyOtp, then inject it
 * into the Playwright context as cookies + localStorage. No browser
 * navigation through magic-link URLs, no /auth/callback handshake, no token
 * material on the wire that could leak via page.url().
 *
 * Why both cookies and localStorage:
 *   - Frontend uses @supabase/ssr (createBrowserClient/createServerClient).
 *     SSR middleware reads cookies; that's the load-bearing path.
 *   - The browser client also keeps a copy in localStorage; setting it
 *     defensively avoids a stale-state hydration race on first reload.
 *   - Cookie encoding is `base64-<base64url(JSON)>` (the default for
 *     @supabase/ssr v0.5+ with cookieEncoding: 'base64url').
 */
export async function mintSessionViaServiceRole(
  context: BrowserContext,
  options: MintOptions,
): Promise<MintResult> {
  const { baseUrl } = options

  const secrets = parseEnvFile(readFileSync(SECRETS_PATH, 'utf8'))
  // Env-var preference: options.email (explicit caller override) > MTW_SMOKE_EMAIL
  // (prod smoke user, default for globalSetup) > MTW_TEST_EMAIL (local dev /
  // staging). Prefer SMOKE when both env vars are set so the same fixture
  // targets prod without a config flag — flipping the target is just a matter
  // of which var is populated in the secrets file. options.email lets a single
  // spec point at a different prod account (e.g. smoke-test-empty@) without
  // forking globalSetup.
  const email =
    options.email || secrets.MTW_SMOKE_EMAIL || secrets.MTW_TEST_EMAIL
  if (!email) {
    throw new Error(
      'Missing email: pass options.email or set MTW_SMOKE_EMAIL / MTW_TEST_EMAIL in ~/.config/secrets/mytravelwallet.env',
    )
  }

  const envLocalPath = `${FRONTEND_DIR}/.env.local`
  const envContent = readFileSync(envLocalPath, 'utf8')
  const env = parseEnvFile(envContent)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  // SECURITY-DEFENSE: serviceRoleKey is `let` not `const`, scoped to this
  // function, and dropped to undefined in the finally block below.
  let serviceRoleKey: string | undefined = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    )
  }

  const { createClient } = requireFromFrontend('@supabase/supabase-js') as {
    createClient: (url: string, key: string, opts?: any) => any
  }
  let admin: ReturnType<typeof createClient> | null = createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let session: any
  try {
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({ type: 'magiclink', email })
    // SECURITY-DEFENSE: discard raw linkError; it can carry request IDs.
    if (linkError) throw new Error('generateLink failed (sanitized)')
    const tokenHash = linkData?.properties?.hashed_token
    if (!tokenHash) {
      throw new Error('generateLink returned no hashed_token')
    }

    const { data: sessionData, error: verifyError } =
      await admin.auth.verifyOtp({
        type: 'magiclink',
        token_hash: tokenHash,
      })
    // SECURITY-DEFENSE: same as above for verifyError.
    if (verifyError) throw new Error('verifyOtp failed (sanitized)')
    if (!sessionData?.session) {
      throw new Error('verifyOtp returned no session')
    }
    session = sessionData.session
  } finally {
    // SECURITY-DEFENSE: drop the service-role key + admin client BEFORE any
    // browser navigation. Anything the page can observe via JS executes
    // after this point; the key must not be reachable.
    admin = null
    serviceRoleKey = undefined
  }

  // Build the SSR cookie payload. Format mirrors what @supabase/ssr writes:
  // a JSON object of session fields, base64url-encoded, with `base64-` prefix.
  const supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const cookieName = `sb-${supabaseProjectRef}-auth-token`
  const sessionPayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: 'bearer',
    user: session.user,
  }
  const cookieValue = encodeSupabaseSsrCookie(sessionPayload)

  // Supabase SSR cookies are chunked into <key>.0, <key>.1, ... once the
  // encoded value exceeds MAX_CHUNK_SIZE (3180). Use the library's own
  // chunker to stay byte-for-byte compatible with what the SSR middleware
  // expects to read back.
  const { createChunks } = requireFromFrontend(
    '@supabase/ssr/dist/main/utils/chunker.js',
  ) as {
    createChunks: (
      key: string,
      value: string,
    ) => { name: string; value: string }[]
  }
  const chunks = createChunks(cookieName, cookieValue)
  await context.addCookies(
    chunks.map((c) => ({
      name: c.name,
      value: c.value,
      // SECURITY-DEFENSE: scoped to baseUrl only; no wildcard domain.
      url: baseUrl,
      httpOnly: false,
      sameSite: 'Lax' as const,
    })),
  )

  // SECURITY-DEFENSE: apply the Vercel deployment-protection bypass header
  // BEFORE the first navigation. Without it, Vercel intercepts every request
  // and redirects to vercel.com/login, the Supabase cookies we just set are
  // never sent to the app origin, and `landedPath` ends up being /login.
  // The helper returns {} when the secret is absent (localhost dev), so this
  // call is safe to make unconditionally. The header is also a credential —
  // see vercel-bypass.ts for redaction rules.
  await context.setExtraHTTPHeaders(getVercelBypassHeader())

  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  // The outer .catch() handles the case where the authenticated root page
  // triggers a client-side redirect (e.g. router.push to /home) between the
  // goto() returning and the evaluate() running, which destroys the page's
  // execution context. Since the cookies set above are the load-bearing path
  // and localStorage is defensive only (see "Why both cookies and localStorage"
  // block above), a failed localStorage write is acceptable. Observed on
  // Vercel preview URLs after authenticated mint; localhost dev does not
  // exhibit this race because the root page does not auto-redirect.
  await page
    .evaluate(
      ({ key, value }: { key: string; value: string }) => {
        try {
          localStorage.setItem(key, value)
        } catch {
          // cookie path is load-bearing; localStorage is defensive only.
        }
      },
      { key: cookieName, value: JSON.stringify(sessionPayload) },
    )
    .catch(() => {})
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
  // SECURITY-DEFENSE: redactUrl() before pathname extraction. Even if Supabase
  // somehow left tokens in the URL, they would be stripped before we observe it.
  const landedPath = new URL(redactUrl(page.url())).pathname
  await page.close()
  return { landedPath }
}
