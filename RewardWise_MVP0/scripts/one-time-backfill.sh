#!/usr/bin/env bash
#
# One-time backfill for the Supabase migrations auto-apply workflow.
#
# Run this ONCE from your laptop AFTER PR #TBD merges and BEFORE the
# next migration-touching PR merges. It marks the 6 pre-existing
# migrations as already applied so `supabase db push` skips them
# instead of re-running them (most are not idempotent).
#
# Prereqs (run these first):
#   brew install supabase/tap/supabase
#   export SUPABASE_ACCESS_TOKEN=<personal access token>
#   export SUPABASE_DB_PASSWORD=<db password>
#   cd RewardWise_MVP0
#   supabase link --project-ref <project ref>
#
# Idempotent: safe to re-run.

set -euo pipefail

if [[ "$(basename "$PWD")" != "RewardWise_MVP0" ]]; then
  echo "ERROR: run this from the RewardWise_MVP0 directory."
  exit 1
fi

TIMESTAMPS=(
  20260430174722  # payment_notifications
  20260506040014  # seed_airline_programs
  20260506040015  # verify_airline_programs
  20260507204425  # public_search_trials
  20260511144232  # booking_handoff_clicks
  20260519235240  # newsletter_signups
)

for ts in "${TIMESTAMPS[@]}"; do
  echo "Marking $ts as applied..."
  supabase migration repair --status applied "$ts"
done

echo ""
echo "Backfill complete. Current migration state:"
supabase migration list
