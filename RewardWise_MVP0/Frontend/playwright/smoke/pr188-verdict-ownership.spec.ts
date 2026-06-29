/**
 * Production smoke: PR #188 — per-option ownership fork on the verdict.
 *
 * Backend PR #188 attaches an `ownership` block to the AUTHENTICATED
 * /api/search response (nested under `verdict`, like every other verdict
 * field on the auth path). It is computed from the caller's live wallet:
 *   - null when the verdict isn't use_points (no points option to fork on);
 *   - a block when use_points, answering "can you actually book the points
 *     option, and if short, is buying the gap rational?" (the b2/b3 states).
 *
 * Because search.py ALWAYS sets the key (`{...verdict, ownership: ...}`), the
 * key's mere presence is the deterministic deployed-vs-stale signal: this spec
 * FAILS against pre-#188 prod (key absent → undefined) and PASSES post-deploy.
 *
 * Coherence contract (holds under EITHER recommendation snapshot — award
 * availability is volatile, so we never hard-demand use_points):
 *   1. Authed /api/search returns 200 and a concrete recommendation.
 *   2. `ownership` key is PRESENT on body.verdict (null or object) — proves the
 *      #188 code path is live.
 *   3. When use_points AND an ownership block is returned, it is internally
 *      coherent: shortfall == max(0, points_needed - owned_balance);
 *      can_afford == (shortfall == 0); fork_recommendation ∈ {use_points,
 *      pay_cash}; a short+can't-afford case never carries a fabricated
 *      buy_gap_cost on a non-buyable program; fork never recommends buying.
 *
 * Auth-path routing mirrors pr-verdict-redesign.spec.ts: drive /home →
 * /api/search (the trial-gated /api/public-search returns no wallet and no
 * ownership). The session is minted by globalSetup's storageState.
 */

import { test, expect } from '@playwright/test'

const DEPART_DAYS = 180
const RETURN_DAYS = 194

interface Ownership {
  applicable?: boolean
  program?: string
  points_needed?: number
  owned_balance?: number
  shortfall?: number
  can_afford?: boolean
  buyable?: boolean
  buy_gap_cost?: number | null
  buy_gap_worth_it?: boolean
  fork_recommendation?: 'use_points' | 'pay_cash'
  fork_reason?: string
}

interface SearchResponse {
  verdict?: {
    recommendation?: 'use_points' | 'pay_cash' | 'wait'
    ownership?: Ownership | null
    metrics?: { cpp?: number | null }
  }
}

function isoDaysFromToday(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

test.describe('PR #188: ownership fork is live + coherent on authed /api/search', () => {
  test('SFO→SIN PE round-trip ×3 — verdict carries a coherent ownership block', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    await page.goto('/home')

    const tryASearchCta = page
      .getByRole('button', { name: /try a (free )?search( first)?/i })
      .first()
    if (await tryASearchCta.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tryASearchCta.click()
    }

    const inputs = page.getByPlaceholder('City or airport')
    await inputs.first().fill('SFO')
    await inputs.first().press('Enter')
    await inputs.nth(1).fill('SIN')
    await inputs.nth(1).press('Enter')

    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.first().fill(isoDaysFromToday(DEPART_DAYS))
    await dateInputs.nth(1).fill(isoDaysFromToday(RETURN_DAYS))

    const selects = page.getByRole('combobox')
    await selects.first().selectOption('3')
    await selects.nth(2).selectOption('premium_economy')

    const searchResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/search(\?|$)/.test(res.url()) &&
        res.request().method() === 'POST',
      { timeout: 120_000 },
    )

    await page.getByRole('button', { name: /Search Flights/i }).click()
    const response = await searchResponsePromise

    expect(response.status(), 'Authed /api/search must return 200').toBe(200)

    const body = (await response.json()) as SearchResponse
    const verdict = body.verdict ?? {}
    const recommendation = verdict.recommendation
    const ownership = verdict.ownership

    console.log(
      `[smoke-pr188] rec=${recommendation} ownership=${JSON.stringify(ownership)}`,
    )

    // CONTRACT 1 — concrete recommendation.
    expect(
      recommendation,
      `Reference case must produce a concrete recommendation; got ${recommendation}.`,
    ).toMatch(/^(use_points|pay_cash)$/)

    // CONTRACT 2 — the #188 key is present (deployed-vs-stale signal). Pre-#188
    // prod omits it entirely, so `'ownership' in verdict` is false there.
    expect(
      'ownership' in verdict,
      'verdict.ownership key must be present on the response — its absence ' +
        'means pre-#188 backend code is still serving prod.',
    ).toBe(true)

    // pay_cash / wait verdicts have no points option to fork on -> null.
    if (recommendation !== 'use_points') {
      expect(
        ownership,
        'Non-use_points verdict must carry ownership=null (no fork).',
      ).toBeNull()
      return
    }

    // CONTRACT 3 — use_points: ownership block (when present) is coherent.
    if (ownership == null) {
      // Acceptable only if the engine produced use_points without a points
      // winner/points_cost; log and pass coherence vacuously.
      console.log('[smoke-pr188] use_points with null ownership (no points_cost)')
      return
    }

    const needed = ownership.points_needed ?? 0
    const owned = ownership.owned_balance ?? 0
    const shortfall = ownership.shortfall ?? 0
    expect(shortfall, 'shortfall == max(0, needed - owned)').toBe(
      Math.max(0, needed - owned),
    )
    expect(ownership.can_afford, 'can_afford == (shortfall === 0)').toBe(
      shortfall === 0,
    )
    expect(
      ownership.fork_recommendation,
      'fork_recommendation must be use_points or pay_cash (never "buy")',
    ).toMatch(/^(use_points|pay_cash)$/)

    // Non-buyable program must never carry a fabricated buy cost.
    if (ownership.buyable === false) {
      expect(
        ownership.buy_gap_cost,
        'non-buyable program must not fabricate a buy_gap_cost',
      ).toBeNull()
    }

    // Affordable -> use_points; short & not-worth-buying -> pay_cash.
    if (ownership.can_afford) {
      expect(ownership.fork_recommendation).toBe('use_points')
    } else if (!ownership.buy_gap_worth_it) {
      expect(ownership.fork_recommendation).toBe('pay_cash')
    }
  })
})
