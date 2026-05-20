# Supabase migrations

Migrations are auto-applied to production on merge to `main` by
`.github/workflows/supabase-migrations.yml`. This doc covers the
file layout, how to add a migration, the 2026-05-19 reconciliation
event (one-time, do not repeat), the forward process, and the
additive-only constraint that the workflow does not enforce
mechanically.

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

## 2026-05-19 reconciliation event

PR #116 introduced the auto-apply workflow. On first push to main
it surfaced 10 migration timestamps in the production
`schema_migrations` ledger that had no corresponding files in the
repo (applied via the Supabase dashboard SQL editor between
2026-05-06 and 2026-05-15). Reconciled by:

1. `supabase migration repair --status reverted` on the 10 timestamps
   (drops their ledger entries; the schema they created stays intact
   in production).
2. `supabase migration repair --status applied` on the 6 local
   timestamps (affirms ledger alignment with files in the repo).
3. `supabase db dump --linked --schema public` → captured the
   cumulative post-reconciliation schema as
   `supabase/snapshots/2026-05-19_post_reconciliation.sql`.

The 6 captured migration files are not self-contained -- they
depend on objects created by the 10 dropped dashboard migrations
(verified by shadow-DB replay failure during `supabase db pull`).
For local dev setup, apply the snapshot first:

```bash
supabase start
psql "$DATABASE_URL" -f supabase/snapshots/2026-05-19_post_reconciliation.sql
supabase db reset
```

## Going forward

Effective 2026-05-19, all schema changes go through this flow:

1. Add a new file to `supabase/migrations/` following the naming
   convention above.
2. Open PR; CI runs (no schema mutation yet).
3. Merge to main → workflow auto-applies the migration to production.
4. Verify in `supabase migration list` that local + remote align.

No more direct dashboard SQL editor mutations. They cause ledger
drift that requires the reconciliation event above.

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
| Ledger drift (file in repo but not in remote ledger, or vice versa) | `db push` errors with migration history mismatch | Use `supabase migration repair` to align; see 2026-05-19 reconciliation event above |

## Why this exists

Manual `supabase db push` after every migration-touching PR merge
was a checklist item that drifted. Auto-applying on merge removes
the human-memory dependency. The App Store v1 sprint is expected
to ship multiple migrations; this prevents that friction from
compounding.
