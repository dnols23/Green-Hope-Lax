-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — saved plays
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The playboard kept its plays in the browser, which meant a play drawn on the
-- laptop on Sunday did not exist on the phone at practice on Monday — and a
-- cleared browser took the lot. They belong to the program, not to a device.
--
-- Coach-only: RLS on with no anon or authenticated policies.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.plays (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  board      jsonb       not null default '{"tokens":[],"paths":[]}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plays_name_idx on public.plays (name);

alter table public.plays enable row level security;
