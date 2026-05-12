create table public.booking_handoff_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program text not null,
  origin text not null,
  destination text not null,
  depart_date date not null,
  return_date date,
  travelers int not null,
  cabin text,
  verdict_type text not null check (verdict_type in ('cash', 'points')),
  amount_cash numeric,
  amount_points int,
  taxes numeric,
  created_at timestamptz not null default now()
);

create index booking_handoff_clicks_program_created_at_idx on public.booking_handoff_clicks (program, created_at desc);

alter table public.booking_handoff_clicks enable row level security;

create policy "users insert own handoff clicks" on public.booking_handoff_clicks for insert with check (auth.uid() = user_id);

create policy "users read own handoff clicks" on public.booking_handoff_clicks for select using (auth.uid() = user_id);
