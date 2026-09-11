-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Drill bank
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The drills a coach reaches for, kept once and dropped into any practice.
-- A drill carries its own link — a video, a diagram, a page in a playbook — so
-- the link travels with the drill instead of being hunted for at 3:30.
--
-- Coach-only: RLS on with no anon or authenticated policies.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.drills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'individual',
  minutes     int  not null default 10,
  description text,
  link        text,
  link_label  text,
  equipment   text,
  is_favorite boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists drills_category_idx on public.drills (category, name);
create index if not exists drills_favorite_idx on public.drills (is_favorite) where is_favorite;

alter table public.drills enable row level security;
