-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — team equipment inventory
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- What the program owns and where it is. Coaches record counts and condition;
-- the JV coach can be limited to JV items from Admin → Coach Access.
--
-- Coach-only, like the evaluations tables: RLS on with no anon or authenticated
-- policies, so it's reachable only by the server behind the admin sign-in.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.team_inventory (
  id         uuid primary key default gen_random_uuid(),
  team       text not null default 'program' check (team in ('program', 'varsity', 'jv')),
  category   text not null default 'other',
  item       text not null,
  size       text,
  quantity   int  not null default 0,
  condition  text not null default 'good' check (condition in ('new', 'good', 'worn', 'retire')),
  location   text,
  notes      text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists team_inventory_team_idx on public.team_inventory (team, category, item);

alter table public.team_inventory enable row level security;
