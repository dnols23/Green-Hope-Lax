-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — program / all-time stats
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- (Run after 0001_init.sql. Safe to re-run.)
--
-- Backs the public /stats page. Each row is one "stat line" (a record, a career
-- leader, a milestone, or a team honor) that coaches add/edit at /admin/stats.
-- The per-season won/loss summary on /stats is computed live from the games
-- table, so it never needs to be entered here.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.program_stats (
  id           uuid primary key default gen_random_uuid(),
  -- which block on the stats page this line shows under
  section      text        not null default 'records',  -- records | leaders | milestones | honors
  gender       program_gender,                          -- null = whole program / both
  label        text        not null,                    -- e.g. "Most Goals (Season)"
  value        text,                                     -- e.g. "98" or "Jane Doe"
  detail       text,                                     -- e.g. "2024 season" / extra context
  season       text,                                     -- optional year tag, e.g. "2026"
  sort_order   int         not null default 0,
  is_published boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.program_stats enable row level security;

-- Public sees published stat lines; admins see/manage everything.
drop policy if exists "public read program_stats" on public.program_stats;
create policy "public read program_stats" on public.program_stats
  for select to anon using (is_published = true);

drop policy if exists "admin read program_stats" on public.program_stats;
create policy "admin read program_stats" on public.program_stats
  for select to authenticated using (true);

drop policy if exists "admin all program_stats" on public.program_stats;
create policy "admin all program_stats" on public.program_stats
  for all to authenticated using (true) with check (true);

create index if not exists program_stats_section_idx
  on public.program_stats (section, sort_order);
