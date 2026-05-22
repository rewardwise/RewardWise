-- Cancellation feedback collected when a user schedules a subscription cancel
-- at period end. Single-row INSERT per cancellation event. Used for retention
-- analysis (which reason codes correlate with what segments).
--
-- Idempotent: safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.cancellation_feedback (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  reason_code             text not null
                          check (char_length(reason_code) between 1 and 64),
  free_text               text
                          check (free_text is null or char_length(free_text) <= 500),
  stripe_subscription_id  text,
  created_at              timestamptz not null default now()
);

-- Reason codes are an open enum maintained in the frontend; we constrain at
-- the app layer rather than the DB to allow adding new options without a
-- migration. The CHECK constraints above bound length only, as defense in
-- depth — the value enum itself lives in the API route.

create index if not exists cancellation_feedback_user_id_idx
  on public.cancellation_feedback (user_id);

create index if not exists cancellation_feedback_created_at_idx
  on public.cancellation_feedback (created_at desc);

create index if not exists cancellation_feedback_reason_code_idx
  on public.cancellation_feedback (reason_code);

-- RLS: authenticated users can INSERT their own row. No SELECT / UPDATE /
-- DELETE policy → analysis is service-role-only. Mirrors newsletter_signups
-- pattern but with one INSERT policy because we need the user's own session
-- to write (not the service role from a Backend FastAPI endpoint).
alter table public.cancellation_feedback enable row level security;

drop policy if exists "users insert own cancellation feedback"
  on public.cancellation_feedback;

create policy "users insert own cancellation feedback"
  on public.cancellation_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());
