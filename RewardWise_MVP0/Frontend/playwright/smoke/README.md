# Production smoke harness

Post-merge smoke specs that run against `https://www.mytravelwallet.ai`.
Each spec asserts the user-visible fix from a specific PR is live on prod.

## When these run

- **Not per-PR-push.** Specs hit real seats.aero + FlightAPI; every run
  costs API quota.
- **Post-merge gate.** Run after a PR lands on `main` and Vercel finishes
  promoting prod. Failure here means a user-visible regression made it past
  CI.

## How to run

```bash
cd Frontend
npx playwright test playwright/smoke/
```

Runs both viewports (1440x900 desktop + 375x812 iPhone SE) via the
`chromium-1440-auth` / `chromium-375-auth` projects defined in
`playwright.config.ts`. Each spec executes once per project.

Override the target origin:

```bash
PLAYWRIGHT_BASE_URL=https://preview-url.vercel.app npx playwright test playwright/smoke/
```

## Auth

`playwright/auth/global-setup.ts` mints a Supabase session per viewport
via the service-role admin path and writes
`playwright/.auth/storage-<viewport>.json`. Each project consumes the
matching storageState file.

Source-of-truth credentials live in `~/.config/secrets/mytravelwallet.env`:

- `MTW_SMOKE_EMAIL` — resolves to a user provisioned in the **production**
  Supabase project. Used by smoke runs.
- `MTW_TEST_EMAIL` — local-dev / staging test user. Fallback when
  `MTW_SMOKE_EMAIL` is unset.

The fixture (`playwright/auth/mint-session.ts`) prefers `MTW_SMOKE_EMAIL`
when both are set, so flipping the target between prod and dev is a matter
of which var is populated — no config flag.

## Smoke test user wallet state

The user behind `MTW_SMOKE_EMAIL` (`smoke-test@mytravelwallet.ai`) is
seeded in production with:

- **Chase Ultimate Rewards:** 100,000 points
- **Amex Membership Rewards:** 100,000 points

These balances are load-bearing for any spec that asserts on Use Points
verdict math. If the wallet is reset, drained, or balances diverge from
the values above, points-redemption assertions in current and future
smoke specs will start failing for reasons unrelated to the code under
test.

If you re-seed the wallet, update this README and any spec that
hard-codes balance-dependent assertions.

## Specs

| File | Verifies | Linked PR |
| --- | --- | --- |
| `pr131-round-trip-return.spec.ts` | Round-trip Use Points search renders BOTH outbound and return flight cards (regression: return leg was silently dropped). | #131 (`a13d418`) |
| `pr3-stops-filter.spec.ts` | Stops=Nonstop search renders only flight cards labeled "Nonstop" (post-merge guard for the Stops filter end-to-end contract). | #135 (`b1366b9`) |

## Adding a new spec

Per the project-wide rule, every PR that fixes a user-visible bug ships
with a smoke spec in this directory that would have caught the
regression. Conventions:

- Name the file `pr<N>-<short-slug>.spec.ts`.
- Header comment block must reference the offending commit SHA and
  describe the pre-fix symptom.
- Use existing `data-testid` attributes where they exist. Where they
  don't, prefer role + position fallbacks (see
  `pr131-round-trip-return.spec.ts` for the pattern).
- Keep selectors tight enough to fail on the regression and loose enough
  to survive minor copy / layout changes.

## Pre-push gate

`scripts/smoke-spec-gate.sh` makes the "user-visible PR ships with a
smoke spec" rule mechanical. Run before push:

```bash
bash scripts/smoke-spec-gate.sh origin/main HEAD
```

Exit 0 = rule satisfied. Exit 1 = rule violated; the script prints the
list of user-visible files in the diff and the two ways to resolve.

If the change genuinely does not warrant a spec (pure refactor,
type-only change, internal abstraction with no DOM impact), bypass with
a git trailer on any commit message in the branch:

```
Smoke-Spec-Not-Required: one-line audit-trail reason
```

Git trailer syntax (a single `Key: value` line at the bottom of the
message) is what the script keys on, so prose mentions of the marker
in documentation commits don't false-positive.
