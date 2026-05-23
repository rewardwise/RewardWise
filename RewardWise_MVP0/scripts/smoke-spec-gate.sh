#!/usr/bin/env bash
#
# smoke-spec-gate.sh — deterministic pre-push check that user-visible
# frontend changes ship with a Playwright smoke spec.
#
# Background: Frontend/playwright/smoke/README.md ("Adding a new spec")
# requires every PR that fixes a user-visible bug on mytravelwallet.ai to
# include a spec under Frontend/playwright/smoke/pr<N>-<slug>.spec.ts. The
# rule was set up after PR #131 and immediately violated on PR #135. This
# script makes the rule mechanical so the next violation cannot land
# silently.
#
# Exit codes:
#   0 — rule satisfied (no user-visible changes, OR a smoke spec is in
#       the diff, OR the branch carries an explicit override marker).
#   1 — rule violated; explanation printed to stdout.
#   2 — script misuse (bad refs, not in a git repo).
#
# Override: include a git trailer
#     Smoke-Spec-Not-Required: <one-line reason>
# at the end of any commit message on the branch. Git trailer syntax is
# load-bearing — it's a single line of the form "Key: value" at the
# bottom of the message, which is git's standard convention for
# opt-out metadata and won't false-positive on prose mentions. The
# reason is audit-trail only; presence of the trailer bypasses the
# check. Use for genuine non-bug-fix work (refactor, type-only change,
# internal abstraction with no DOM impact).
#
# Usage:
#   scripts/smoke-spec-gate.sh [BASE_REF] [HEAD_REF]
#
# Defaults: BASE_REF=origin/main, HEAD_REF=HEAD
#
# Run from the repo root.

set -euo pipefail

BASE_REF="${1:-origin/main}"
HEAD_REF="${2:-HEAD}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "smoke-spec-gate: not inside a git repo" >&2
  exit 2
fi

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "smoke-spec-gate: cannot resolve BASE_REF '$BASE_REF'" >&2
  exit 2
fi

if ! git rev-parse --verify "$HEAD_REF" >/dev/null 2>&1; then
  echo "smoke-spec-gate: cannot resolve HEAD_REF '$HEAD_REF'" >&2
  exit 2
fi

# Override check — if any commit on the branch carries a
# "Smoke-Spec-Not-Required:" git trailer, gate passes immediately.
# We extract trailers via git interpret-trailers rather than grepping
# the raw message so prose mentions of the trailer key (e.g., in
# documentation commits about the gate itself) do not false-positive.
TRAILER_VALUES=$(
  for sha in $(git rev-list "$BASE_REF..$HEAD_REF"); do
    git log -1 --format=%B "$sha" \
      | git interpret-trailers --parse \
      | grep -E '^Smoke-Spec-Not-Required:' \
      || true
  done
)
if [[ -n "$TRAILER_VALUES" ]]; then
  echo "smoke-spec-gate: PASS (Smoke-Spec-Not-Required trailer present)"
  echo "$TRAILER_VALUES" | sed 's/^/  /'
  exit 0
fi

CHANGED=$(git diff --name-only "$BASE_REF...$HEAD_REF")

# User-visible surfaces: anything under these directories renders to the
# prod DOM on mytravelwallet.ai. Both legacy top-level and nested-repo
# layouts (RewardWise_MVP0/Frontend/...) are matched.
USER_VISIBLE_PATTERN='^(RewardWise_MVP0/)?Frontend/(app|components|lib|utils|styles|public|hooks)/'

# Exclusions within the Frontend tree that do NOT ship to users.
EXCLUDE_PATTERN='(\.test\.[tj]sx?$|\.spec\.[tj]sx?$|/__tests__/|/playwright/|\.md$|\.config\.(ts|js|mjs)$|/?package(-lock)?\.json$|tsconfig)'

USER_VISIBLE_CHANGES=$(echo "$CHANGED" \
  | grep -E "$USER_VISIBLE_PATTERN" \
  | grep -Ev "$EXCLUDE_PATTERN" || true)

if [[ -z "$USER_VISIBLE_CHANGES" ]]; then
  echo "smoke-spec-gate: PASS (no user-visible frontend changes in diff)"
  exit 0
fi

# Diff touches user-visible surfaces; a new smoke spec must be present
# in the same diff.
NEW_SMOKE_SPECS=$(echo "$CHANGED" \
  | grep -E '^(RewardWise_MVP0/)?Frontend/playwright/smoke/pr[^/]+\.spec\.ts$' \
  || true)

if [[ -n "$NEW_SMOKE_SPECS" ]]; then
  echo "smoke-spec-gate: PASS (smoke spec in diff)"
  echo "$NEW_SMOKE_SPECS" | sed 's/^/  + /'
  exit 0
fi

cat <<EOF
smoke-spec-gate: FAIL — smoke spec required per project rule.

The diff modifies user-visible frontend surfaces but does NOT include a
new spec under Frontend/playwright/smoke/.

Rule source: Frontend/playwright/smoke/README.md ("Adding a new spec")
plus the project-wide policy that every user-visible bug fix ships with
a Playwright spec that would have failed pre-fix and passes post-fix on
https://www.mytravelwallet.ai.

User-visible files in this diff:
$(echo "$USER_VISIBLE_CHANGES" | sed 's/^/  /')

Resolve by one of:
  (a) Add Frontend/playwright/smoke/pr<N>-<slug>.spec.ts that asserts
      the user-visible fix on prod. Run it before push:
        cd Frontend && npx playwright test playwright/smoke/
  (b) If the change genuinely does not warrant a spec (pure refactor,
      type-only, internal abstraction with no DOM impact), add a git
      trailer to any commit message on the branch:
        Smoke-Spec-Not-Required: <one-line audit-trail reason>
EOF
exit 1
