import { defineConfig, devices } from '@playwright/test'
import { join } from 'node:path'

export default defineConfig({
  // testDir is the playwright/ root so both tests/ (legacy critical-paths)
  // and smoke/ (production smoke specs) are picked up.
  testDir: './playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Smoke specs hit real seats.aero + FlightAPI; per-test default of 30s is
  // too tight for end-to-end search-to-verdict flows.
  timeout: 60_000,
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  // globalSetup mints a Supabase session via service-role admin path and writes
  // storageState files to playwright/.auth/storage-<viewport>.json. Tests that
  // need authentication declare the matching storageState in their project.
  globalSetup: require.resolve('./playwright/auth/global-setup'),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://www.mytravelwallet.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Authenticated desktop project. Consumes the storageState file produced
      // by globalSetup for the 1440x900 viewport.
      name: 'chromium-1440-auth',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: join(__dirname, 'playwright/.auth/storage-1440x900.json'),
      },
    },
    {
      // Authenticated mobile project (iPhone SE viewport). Consumes the
      // storageState file produced by globalSetup for the 375x812 viewport.
      name: 'chromium-375-auth',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        storageState: join(__dirname, 'playwright/.auth/storage-375x812.json'),
      },
    },
  ],
})
