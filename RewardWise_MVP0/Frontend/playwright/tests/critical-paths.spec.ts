/**
 * Critical-path smoke tests (V0b).
 *
 * Target: https://www.mytravelwallet.ai (production).
 *
 * Cost / flakiness considerations:
 * - A full suite run makes ~6 live API calls (2 searches × ~3 backend calls each)
 *   against seats.aero + FlightAPI. Real cost per run.
 * - Subject to third-party API flakiness. If Flow 2 or 3 fails, check
 *   seats.aero and FlightAPI status pages before assuming an app regression.
 * - V1 plan: replace production target with a Vercel preview URL and mock the
 *   downstream APIs (or use a dedicated test backend).
 */

import { test, expect } from '@playwright/test'

// AirportSearch commits to parent state only after a dropdown selection. The
// typeahead dropdown opens on input; pressing Enter selects the first result
// (which carries the airport code for single airports or the CSV for metros).
async function selectAirport(input: ReturnType<typeof Object>, code: string) {
  await input.click()
  await input.fill(code)
  await input.press('Enter')
}

// Verdict assertion: "The Verdict" header text is unique to VerdictCard.tsx
// on the landing page (only rendered after a successful search returns).
//
// Original plan called for a fallback to /^(Pay Cash|Use Points|Wait)$/ labels,
// but those words appear in the hero sample verdict card at app/page.tsx:582
// — always visible on desktop, so the fallback would silently false-pass before
// the search ever ran. Single-selector assertion is the correct shape.
async function expectVerdictRendered(page: import('@playwright/test').Page) {
  await expect(page.getByText(/^The Verdict$/i)).toBeVisible({ timeout: 60000 })
}

test.describe('Critical paths smoke', () => {
  test('homepage loads with search form', async ({ page }) => {
    await page.goto('/')

    // Hero confirms the landing page rendered without a crash boundary.
    await expect(page.getByRole('heading', { name: /Travel smarter/i })).toBeVisible({ timeout: 10000 })

    // Search form is hidden behind a toggle on the landing page — reveal it.
    await page.getByRole('button', { name: /Or try a search first/i }).click()

    // After reveal, both airport inputs share the placeholder "City or airport".
    const cityInputs = page.getByPlaceholder('City or airport')
    await expect(cityInputs.first()).toBeVisible({ timeout: 5000 })
    await expect(cityInputs.nth(1)).toBeVisible()

    // Date input + submit button.
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Search Flights/i })).toBeVisible()
  })

  test('single-airport search returns verdict (SEA to NRT)', async ({ page }) => {
    test.skip(true, 'Blocked by production "one free search" gate — server returns rate-limit banner instead of verdict on the 2nd+ unauthenticated search per IP. Needs auth fixture or mocked APIs (V1). Test body retained so un-skipping requires only removing this line.')

    await page.goto('/')
    await page.getByRole('button', { name: /Or try a search first/i }).click()

    // Roundtrip requires return date; switch to one way to keep the test minimal.
    await page.getByRole('button', { name: /^One Way$/ }).click()

    const cityInputs = page.getByPlaceholder('City or airport')
    await selectAirport(cityInputs.first(), 'SEA')
    await selectAirport(cityInputs.nth(1), 'NRT')

    await page.locator('input[type="date"]').first().fill('2026-08-15')
    await page.getByRole('button', { name: /Search Flights/i }).click()

    await expectVerdictRendered(page)
  })

  test('metro-airport search returns verdict (NYC to TYO, PR #87 regression)', async ({ page }) => {
    test.skip(true, 'Blocked by production "one free search" gate — same as SEA→NRT flow above. PR #87 metro-grouping regression coverage is therefore gapped until auth fixture or mocked APIs land (V1).')

    await page.goto('/')
    await page.getByRole('button', { name: /Or try a search first/i }).click()
    await page.getByRole('button', { name: /^One Way$/ }).click()

    const cityInputs = page.getByPlaceholder('City or airport')
    await selectAirport(cityInputs.first(), 'NYC')
    await selectAirport(cityInputs.nth(1), 'TYO')

    await page.locator('input[type="date"]').first().fill('2026-08-15')
    await page.getByRole('button', { name: /Search Flights/i }).click()

    // Verdict must render — and the metro-grouping error from PR #87 must not appear.
    await expectVerdictRendered(page)
    await expect(page.getByText(/Invalid (origin|destination) airport code/i)).not.toBeVisible()
  })

  test('wallet save flow works', async () => {
    test.skip(true, 'Auth required for /wallet-setup — pending auth fixture (Phase 1 audit, ticket TBD)')
  })
})
