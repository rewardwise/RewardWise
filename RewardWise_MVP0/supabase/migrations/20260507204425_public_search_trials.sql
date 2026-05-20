-- Safe to run multiple times. This creates the storage needed for one-time guest searches.
-- It does not delete or modify existing rows.

create extension if not exists pgcrypto;

create table if not exists public.public_search_trials (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  user_agent_hash text,
  origin text,
  destination text,
  departure_date date,
  return_date date,
  cabin text,
  travelers integer,
  status text not null default 'started',
  request_payload jsonb,
  response_summary jsonb,
  error_message text,
  used_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.public_search_trials
  add column if not exists ip_hash text,
  add column if not exists user_agent_hash text,
  add column if not exists origin text,
  add column if not exists destination text,
  add column if not exists departure_date date,
  add column if not exists return_date date,
  add column if not exists cabin text,
  add column if not exists travelers integer,
  add column if not exists status text not null default 'started',
  add column if not exists request_payload jsonb,
  add column if not exists response_summary jsonb,
  add column if not exists error_message text,
  add column if not exists used_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists public_search_trials_ip_hash_uidx
  on public.public_search_trials (ip_hash);

create index if not exists public_search_trials_used_at_idx
  on public.public_search_trials (used_at desc);

create index if not exists public_search_trials_route_idx
  on public.public_search_trials (origin, destination, departure_date);

alter table public.public_search_trials enable row level security;
