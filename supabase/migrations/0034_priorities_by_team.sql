-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — a priority list per team
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Varsity and JV keep two different lists of what needs work. One shared
-- Offense list means a JV note lands in front of the varsity staff on Sunday,
-- and neither side trusts what it reads.
--
-- Everything already on file stays varsity, which is where it was written.
-- The JV side starts with the same five headings, empty.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.priority_lists
  add column if not exists team text not null default 'varsity';

update public.priority_lists set team = 'varsity' where team is null or team = '';

-- One "Offense" per team rather than one in the whole program. The old index
-- has to go first: it is what stops JV having a list of the same name.
drop index if exists public.priority_lists_name_idx;

create unique index if not exists priority_lists_team_name_idx
  on public.priority_lists (team, lower(name));

create index if not exists priority_lists_team_idx
  on public.priority_lists (team, sort_order);

-- The headings a JV staff keeps. Renaming or deleting one later is fine; this
-- only fills an empty shelf.
insert into public.priority_lists (name, sort_order, team) values
  ('Offense',        1, 'jv'),
  ('Defense',        2, 'jv'),
  ('Man-up',         3, 'jv'),
  ('Man-down',       4, 'jv'),
  ('Ride and clear', 5, 'jv')
on conflict do nothing;
