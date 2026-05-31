-- Drop the residual UNIQUE index on public_search_trials.ip_hash so the
-- count-based trial gate in app/api/search.py (`SELECT id WHERE ip_hash=X
-- LIMIT 3; raise 429 if count >= 3`) actually enforces the configured 3-search
-- limit. The unique index was created when the limit was 1; when the limit
-- moved to 3 the gate code was updated but the index was not dropped. Effect:
-- every 2nd+ search from the same IP failed the INSERT with 23505, fell into
-- the race-case `except` branch, and surfaced "you've used your 3 free
-- searches" — silently enforcing 1, not 3, and making the live "3 free
-- searches" paywall copy false.
--
-- Safety:
--   - Idempotent: `if exists`.
--   - No code path relies on the unique constraint. The only writers
--     (`insert_one(...)` and `update(...).eq("id", trial_id)`) never key on
--     ip_hash; the SELECT-then-INSERT already expects multiple rows per
--     ip_hash. The non-unique route + used_at indexes remain.

drop index if exists public.public_search_trials_ip_hash_uidx;

create index if not exists public_search_trials_ip_hash_idx
  on public.public_search_trials (ip_hash);
