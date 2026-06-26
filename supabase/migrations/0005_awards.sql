-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Team Awards
-- Run once in Supabase SQL Editor. Safe to re-run (re-seeds the 2026 awards).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.team_awards (
  id          uuid primary key default gen_random_uuid(),
  season      text not null,                 -- e.g. '2026'
  award       text not null,                 -- e.g. 'Team MVP'
  recipient   text not null,                 -- player name (matched to roster for the icon)
  description text,                           -- optional subtitle
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists team_awards_idx on public.team_awards (season desc, sort_order);

-- Public info (like the roster): anyone can read; only authenticated admins write.
alter table public.team_awards enable row level security;

drop policy if exists "public read awards" on public.team_awards;
create policy "public read awards" on public.team_awards
  for select to anon, authenticated using (true);

drop policy if exists "admin write awards" on public.team_awards;
create policy "admin write awards" on public.team_awards
  for all to authenticated using (true) with check (true);

-- ── 2026 awards ───────────────────────────────────────────────────────────────
delete from public.team_awards where season = '2026';
insert into public.team_awards (season, award, recipient, description, sort_order) values
  ('2026', 'Team MVP',             'Tripp Stafford', null,                     1),
  ('2026', 'Golden Falcon Award',  'Landon Cowen',   'Male Athlete of the Year', 2),
  ('2026', 'The Juice',            'Holden Hanckel', null,                     3);
