# Supabase migrations

Migrations are auto-applied to production on merge to `main` by
`.github/workflows/supabase-migrations.yml`. This doc covers the
file layout, how to add a migration, the one-time backfill that
seeds the existing 6 migrations, and the additive-only constraint
that the workflow does not enforce mechanically.

## File layout

```
RewardWise_MVP0/supabase/migrations/
  20260430174722_payment_notifications.sql
  20260506040014_seed_airline_programs.sql
  20260506040015_verify_airline_programs.sql
  20260507204425_public_search_trials.sql
  20260511144232_booking_handoff_clicks.sql
  20260519235240_newsletter_signups.sql
```

Naming: `YYYYMMDDHHMMSS_short_name.sql` (UTC). The Supabase CLI
applies migrations in lexicographic order; the timestamp prefix
guarantees correct ordering.

## Adding a new migration

1. Pick a UTC timestamp newer than the most recent migration on
   `main` (e.g., `date -u +%Y%m%d%H%M%S`).
2. Create the file at `RewardWise_MVP0/supabase/migrations/<ts>_<name>.sql`.
3. Write the SQL. Prefer `IF NOT EXISTS` / `IF EXISTS` guards so a
   re-run is harmless if the workflow ever retries.
4. Open a PR. On merge, GitHub Actions applies it automatically.

## Required repo secrets

Set under `Settings -> Secrets and variables -> Actions`:

| Secret | Source |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard -> Account -> Access Tokens |
| `SUPABASE_PROJECT_REF` | 20-char ref in the project URL `https://<ref>.supabase.co` |
| `SUPABASE_DB_PASSWORD` | Project -> Database -> Connection string (password set at project creation) |

## One-time backfill (run once after this PR merges)

The 6 pre-existing migrations were created before the workflow
existed and are already applied in production. The backfill script
records them as applied in the migrations tracking table so the
workflow's `db push` does not try to re-run them.

```bash
brew install supabase/tap/supabase
export SUPABASE_ACCESS_TOKEN=<token>
export SUPABASE_DB_PASSWORD=<password>
cd RewardWise_MVP0
supabase link --project-ref <ref>
./scripts/one-time-backfill.sh
```

The script is idempotent. Verify with `supabase migration list`:
all 6 timestamps should show `Local | Remote | Time` with the remote
column populated.

## Additive-only constraint

The workflow auto-applies migrations on merge. The Backend deploys
hourly via `render-hourly-deploy.yml` cron, so there is a window of
up to 1 hour where new schema is live but old Backend code is still
serving traffic.

This is fine for **additive** changes:
- `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, new RPCs

This will **break** under destructive changes:
- `DROP COLUMN`, `DROP TABLE`, `RENAME`, `ALTER COLUMN TYPE`

For destructive changes, coordinate with a manual Backend deploy
immediately after merge. Better: do the destructive change in two
phases (deploy code that ignores the old field first, then drop in
a follow-up migration).

## Failure modes

| Failure | What you see | What to do |
| --- | --- | --- |
| SQL syntax error | Workflow fails at `Apply pending migrations`; logs show postgres error | Push a fix PR; the migration retries on next merge |
| Bad `SUPABASE_DB_PASSWORD` | Auth error from `db push` | Rotate secret, re-run workflow from Actions tab |
| Supabase outage | `link` or `push` step network error | Re-run workflow once Supabase is healthy |
| Two PRs merge near-simultaneously | Second run queues behind first via concurrency lane | No action; both apply in merge order |
| Backfill not run yet | First auto-run errors when trying to re-apply existing migrations | Run `scripts/one-time-backfill.sh`, then re-run workflow |

## Why this exists

Manual `supabase db push` after every migration-touching PR merge
was a checklist item that drifted. Auto-applying on merge removes
the human-memory dependency. The App Store v1 sprint is expected
to ship multiple migrations; this prevents that friction from
compounding.
