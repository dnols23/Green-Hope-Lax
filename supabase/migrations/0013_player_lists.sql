-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — named rosters
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The public /roster page shows players where is_active = true. Coaches need
-- their own lists on top of that: "2026 Tryouts", "Fall Ball", "2025-2026
-- Season" — groups they build, name, and evaluate through, without any of it
-- reaching the public page.
--
-- A roster is a named list; its members point at rows in `players`. Someone
-- imported for tryouts is created with is_active = false, so they can be
-- evaluated all season and never appear publicly until you say so. Evaluations
-- key on players.id and so keep working untouched.
--
-- Coach-only: RLS on with no anon or authenticated policies, reachable only by
-- the server behind the admin sign-in.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.player_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  season      text,
  notes       text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.player_list_members (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.player_lists(id) on delete cascade,
  player_id  uuid not null references public.players(id)      on delete cascade,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, player_id)
);

create index if not exists player_list_members_list_idx   on public.player_list_members (list_id, sort_order);
create index if not exists player_list_members_player_idx on public.player_list_members (player_id);
create index if not exists player_lists_archived_idx      on public.player_lists (is_archived, name);

alter table public.player_lists        enable row level security;
alter table public.player_list_members enable row level security;
