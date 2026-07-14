-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Coaches Hub: player evaluations + coach roles
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Assistant coaches submit player evaluations; the Head Coach sees everyone's
-- and a compiled board. These are coach-only tables: RLS is on with NO public
-- policies, so they're reachable only via the server (service role) behind the
-- admin sign-in, with role checks in the app. Nothing is exposed to the anon API.
-- ════════════════════════════════════════════════════════════════════════════

-- ── coach_accounts: who's a coach, and are they Head or Assistant ─────────────
create table if not exists public.coach_accounts (
  email        text primary key,                 -- lowercase login email (e.g. hcnolan@ghfalcons.local)
  display_name text not null,
  role         text not null default 'assistant' check (role in ('head', 'assistant')),
  created_at   timestamptz not null default now()
);

-- ── evaluations: one per (player, coach, season) ──────────────────────────────
create table if not exists public.evaluations (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.players(id) on delete cascade,
  evaluator_email  text not null,
  evaluator_name   text not null,
  season           text not null default '2026',
  position         text,
  ratings          jsonb not null default '{}'::jsonb,   -- { category_key: 1..5 }
  overall          int,
  strengths        text,
  areas_to_improve text,
  playing_time     text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (player_id, evaluator_email, season)
);

create index if not exists evaluations_player_idx    on public.evaluations (player_id);
create index if not exists evaluations_evaluator_idx on public.evaluations (evaluator_email);

-- ── Security: coach-only, server-side (service role) access ──────────────────
alter table public.coach_accounts enable row level security;
alter table public.evaluations    enable row level security;
-- Intentionally NO anon/authenticated policies — same lock-down as team_posts.
-- The app reads/writes these with the service-role client after checking the
-- signed-in coach's role, so assistant coaches can never read the compiled board.

-- ── Seed the Head Coach ───────────────────────────────────────────────────────
insert into public.coach_accounts (email, display_name, role)
values ('hcnolan@ghfalcons.local', 'Coach Nolan', 'head')
on conflict (email) do update set role = 'head';
