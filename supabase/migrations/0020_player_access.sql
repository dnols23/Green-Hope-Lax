-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — player invite links, personal drill sets, and publishing
-- a plan to the people it is for
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Three things:
--   1. player_access — one invite link per player. The link carries a random
--      token; following it tells the Team Hub which player is looking, so they
--      see their own evaluation and their own drill set and nobody else's.
--      Revoking is a row update, not a password change for the whole team.
--   2. player_drill_sets — the set a coach generated from a player's most recent
--      evaluation. Kept rather than recomputed so a player's page doesn't change
--      under them, and so a coach can see what was actually prescribed.
--   3. plans.publish_* — a practice plan is a coach's working document until it
--      is published; then it appears in the coaches' War Room, on the players'
--      page, or both.
--
-- Coach-only tables: RLS on with no anon or authenticated policies.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.player_access (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at  timestamptz
);

create unique index if not exists player_access_player_idx on public.player_access (player_id);
create index if not exists player_access_token_idx on public.player_access (token) where revoked_at is null;

create table if not exists public.player_drill_sets (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  -- [{ drillId, name, category, link, reason, repsPerWeek, focus }]
  items        jsonb not null default '[]'::jsonb,
  -- The evaluation it came out of, and the headline numbers, so the player page
  -- can say why these drills without re-reading every evaluation.
  source_eval_id uuid,
  focus        jsonb not null default '[]'::jsonb,
  note         text,
  season       text,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists player_drill_sets_player_idx on public.player_drill_sets (player_id, created_at desc);

alter table public.plans add column if not exists publish_players boolean not null default false;
alter table public.plans add column if not exists publish_coaches boolean not null default true;

alter table public.player_access     enable row level security;
alter table public.player_drill_sets enable row level security;
