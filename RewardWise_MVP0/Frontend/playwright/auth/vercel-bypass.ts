/**
 * Vercel Deployment Protection bypass helper.
 *
 * Vercel preview URLs are gated by an SSO interstitial unless the request
 * carries an automation bypass secret. Without it, every Playwright nav
 * lands on vercel.com/login and assertions read Vercel's login DOM, not
 * the app's — every check FAILs with a misleading "element not found".
 *
 * Operational requirement: set `VERCEL_AUTOMATION_BYPASS_SECRET` in the
 * Vercel project settings (Settings → Deployment Protection → "Protection
 * Bypass for Automation") and mirror the value into
 * `~/.config/secrets/mytravelwallet.env`. The runner reads it from there.
 *
 * SECURITY-DEFENSE:
 *   1. Secret is loaded once per process from a 0600-mode env file. Never
 *      hard-coded, never embedded in commits, never echoed to stdout.
 *   2. The only way the value leaves this module is via the header object
 *      returned by getVercelBypassHeader(). Do NOT add a getter that
 *      returns the raw string for logging/printing/screenshot annotation.
 *   3. If a future contributor adds request/response/header logging to the
 *      runner, the header name `x-vercel-protection-bypass` must be on
 *      that logger's redaction list. The value is a credential equivalent
 *      to a project-wide bypass token.
 *   4. Absence is a warning, not an error: localhost dev (and any
 *      non-Vercel target) does not need this header, and we want the
 *      runner to keep working there.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const SECRETS_PATH = `${homedir()}/.config/secrets/mytravelwallet.env`
const ENV_KEY = 'VERCEL_AUTOMATION_BYPASS_SECRET'
const HEADER_NAME = 'x-vercel-protection-bypass'

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

// undefined = not yet read, null = read but absent, string = found
let cached: string | null | undefined = undefined
let warned = false

function readSecret(): string | null {
  if (cached !== undefined) return cached
  try {
    const env = parseEnvFile(readFileSync(SECRETS_PATH, 'utf8'))
    const v = env[ENV_KEY]
    cached = v && v.length > 0 ? v : null
  } catch {
    cached = null
  }
  if (cached === null && !warned) {
    // Single-line, non-throwing warning so the runner still works against
    // localhost / non-Vercel targets. Treat the absence as configuration
    // intent, not failure.
    process.stderr.write(
      `WARN: ${ENV_KEY} not set; preview runs will hit Vercel SSO wall.\n`,
    )
    warned = true
  }
  return cached
}

/**
 * Returns a header object suitable for `context.setExtraHTTPHeaders()`.
 * Empty object when the secret is absent — callers can spread it
 * unconditionally without checking.
 *
 * Header approach (not `?x-vercel-set-bypass-cookie=true` query string):
 * keeps the bypass intent out of URLs that surface in logs, screenshots,
 * and JSON reports. The header travels on every request the context
 * issues, including initial navigation and subsequent fetch calls.
 */
export function getVercelBypassHeader(): Record<string, string> {
  const s = readSecret()
  return s ? { [HEADER_NAME]: s } : {}
}

/**
 * Force re-read of the secret file. Test-only.
 */
export function __resetVercelBypassCache(): void {
  cached = undefined
  warned = false
}
