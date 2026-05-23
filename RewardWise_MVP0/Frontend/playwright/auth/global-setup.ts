/**
 * Playwright globalSetup: mints an authenticated Supabase session and writes
 * a storageState file per supported viewport. Runs once per Playwright
 * invocation; tests that declare `storageState` consume the result.
 *
 * Outputs: playwright/.auth/storage-<viewport>.json
 *
 * BASE_URL is read from PLAYWRIGHT_BASE_URL (or BASE_URL as fallback) and
 * matches the same env contract playwright.config.ts uses. For production
 * smoke runs, PLAYWRIGHT_BASE_URL is the prod origin
 * (https://www.mytravelwallet.ai). For local dev, default is
 * http://localhost:3000.
 *
 * Viewports: smoke harness covers BOTH desktop (1440x900) and mobile
 * (375x812, iPhone SE). Each emits a separate storageState file so the
 * corresponding Playwright project can consume the matching session.
 *
 * Note: this setup does NOT validate the landed path (e.g. whether the user
 * was redirected to /subscribe due to expired sub). That distinction is
 * made by individual smoke specs.
 */

import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { mintSessionViaServiceRole } from './mint-session'

interface Viewport {
  name: string
  width: number
  height: number
  isMobile: boolean
}

const VIEWPORTS: Viewport[] = [
  { name: '1440x900', width: 1440, height: 900, isMobile: false },
  { name: '375x812', width: 375, height: 812, isMobile: true },
]

const AUTH_DIR = join(__dirname, '..', '.auth')

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Default must match playwright.config.ts use.baseURL so cookies mint to
  // the same origin tests run against. Mismatch = cookies scoped to localhost,
  // tests hit prod, no session, every assertion sees the logged-out DOM.
  // Local dev override: set PLAYWRIGHT_BASE_URL=http://localhost:3000.
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.BASE_URL ||
    'https://www.mytravelwallet.ai'

  mkdirSync(AUTH_DIR, { recursive: true })

  for (const viewport of VIEWPORTS) {
    const storagePath = join(AUTH_DIR, `storage-${viewport.name}.json`)
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        hasTouch: viewport.isMobile,
      })
      await mintSessionViaServiceRole(context, { baseUrl })
      await context.storageState({ path: storagePath })
      await context.close()

      // Sanity check: a real Supabase session storageState lands in the
      // 4-8 KB range. Anything under 500 bytes means cookies didn't write.
      const size = statSync(storagePath).size
      if (size < 500) {
        throw new Error(
          `storageState ${storagePath} is suspiciously small (${size} bytes); auth likely failed silently`,
        )
      }
      console.log(
        `[auth-setup] minted ${viewport.name} session (${size} bytes) at ${storagePath}`,
      )
    } finally {
      await browser.close()
    }
  }
}
