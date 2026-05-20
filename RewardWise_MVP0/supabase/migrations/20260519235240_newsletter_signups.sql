-- Newsletter signups from the public landing page.
-- Safe to run multiple times. Service-role-only access (RLS enabled, no policies).

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.newsletter_signups (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null,
  ip_hash         text,
  source          text not null default 'landing-footer',
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.newsletter_signups
  add column if not exists email           citext,
  add column if not exists ip_hash         text,
  add column if not exists source          text not null default 'landing-footer',
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists created_at      timestamptz not null default now(),
  add column if not exists updated_at      timestamptz not null default now();

create unique index if not exists newsletter_signups_email_uidx
  on public.newsletter_signups (email);

create index if not exists newsletter_signups_created_at_idx
  on public.newsletter_signups (created_at desc);

-- RLS enabled with NO policies → anon + authenticated roles get zero access.
-- Service role bypasses RLS, so the Backend FastAPI endpoint (using SUPABASE_SERVICE_ROLE_KEY)
-- is the only path that can read or write this table. No public read, no public write.
alter table public.newsletter_signups enable row level security;
