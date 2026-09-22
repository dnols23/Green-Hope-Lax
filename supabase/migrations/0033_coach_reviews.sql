-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — coach reviews (head coach only)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The staff's own end-of-season review. Players are evaluated by every coach
-- and the whole staff reads the result; a coach is reviewed by the head coach
-- alone, and nobody else ever sees it — not the other assistants, and not the
-- coach being reviewed.
--
-- That privacy is enforced two ways. In the app, every page and action behind
-- this table calls requireOwner(). In the database, RLS is on with no anon or
-- authenticated policies at all, so only the service role reaches these rows —
-- the same lock the player contact details sit behind.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.coach_reviews (
  id                uuid primary key default gen_random_uuid(),
  -- The coach being reviewed — their login, e.g. ocrutledge@ghfalcons.local.
  coach_email       text        not null,
  -- Their name as it stood at the time, so a review still reads properly after
  -- somebody is renamed or removed from Coach Access.
  coach_name        text        not null,
  season            text        not null,
  -- One entry per category key, same shape as player evaluations:
  -- { "teaching": { "score": 72, "note": "…" }, … }
  ratings           jsonb       not null default '{}'::jsonb,
  overall           int,
  strengths         text,
  areas_to_improve  text,
  -- Where they stand for next season.
  standing          text,
  notes             text,
  -- 'draft' while the season is still running, 'final' once it is signed off.
  status            text        not null default 'draft',
  reviewer_email    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One review per coach per season: opening last year's by mistake and typing
-- over it is the failure worth designing out. Plain columns rather than
-- lower(coach_email), because the app upserts on exactly this pair — and it
-- lowercases the address before every read and write, so the two can't drift.
create unique index if not exists coach_reviews_coach_season_idx
  on public.coach_reviews (coach_email, season);

create index if not exists coach_reviews_season_idx
  on public.coach_reviews (season);

alter table public.coach_reviews enable row level security;
