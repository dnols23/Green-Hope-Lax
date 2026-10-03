-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — positional progressions
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A progression is drills from the bank in a set order — a development routine
-- for one position (attack, poles, goalies…). Built on the Drill Bank's
-- Progressions tab; dropped into a practice plan as one block.
--
-- steps: [{ "drillId": uuid, "minutes": int, "note": text }, …] in order.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.drill_progressions (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  position    text        not null default 'all',
  notes       text,
  steps       jsonb       not null default '[]'::jsonb,
  sort_order  int         not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists drill_progressions_position_idx on public.drill_progressions (position, sort_order);

alter table public.drill_progressions enable row level security;
