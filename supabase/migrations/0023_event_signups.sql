-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — one-day event sign-ups (playdays, clinics, showcases)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The fall league has its own table because it is a season. A playday is not —
-- it is one Saturday, and there will be another one next year against somebody
-- else. So they share a table with an `event` key, and a new playday needs a
-- page and an entry in src/lib/signups.ts, not a migration.
--
-- `paid` is here because these are collected by Venmo, and the only place a
-- coach can tick somebody off is a list they already have open.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.event_signups (
  id            uuid primary key default gen_random_uuid(),
  event         text        not null,
  player_first  text        not null,
  player_last   text        not null,
  grad_year     text,
  position      text,
  parent_name   text        not null,
  parent_email  text        not null,
  parent_phone  text        not null,
  player_email  text,
  notes         text,
  paid          boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists event_signups_event_idx on public.event_signups (event, created_at desc);

-- Same posture as the other form tables: anyone may sign up, nobody anonymous
-- may read the list back, admins get everything.
alter table public.event_signups enable row level security;

drop policy if exists "public insert event signups" on public.event_signups;
create policy "public insert event signups" on public.event_signups
  for insert to anon, authenticated with check (true);

drop policy if exists "admin all event signups" on public.event_signups;
create policy "admin all event signups" on public.event_signups
  for all to authenticated using (true) with check (true);

-- Both sign-up pages become switchable from Admin → Pages like every other
-- page. /swfl was never listed, so it could not be turned off at all.
insert into public.page_settings (key, label, href, sort_order) values
  ('swfl',            'SWFL Fall League',        '/swfl',            13),
  ('barton-playday',  'Barton College Playday',  '/barton-playday',  14)
on conflict (key) do update
  set label = excluded.label, href = excluded.href, sort_order = excluded.sort_order;
