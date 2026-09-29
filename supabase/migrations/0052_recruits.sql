-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — recruits
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Kids the staff is reaching out to about playing lacrosse: who they are,
-- their handle, a parent to reach, and where it stands — identified, tweeted,
-- followed back, talking, visited, joined or not interested. Every coach adds
-- and updates. Coach-only; the website server reads and writes it.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.recruits (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  grad_year       int,
  school          text,
  -- What they play now, and where on a lacrosse field they might fit.
  sports          text,
  position        text,
  -- X handle, without the @.
  handle          text,
  parent_name     text,
  parent_contact  text,
  status          text        not null default 'identified'
                  check (status in ('identified', 'tweeted', 'followed', 'talking', 'visited', 'joined', 'passed')),
  next_step       text,
  notes           text,
  -- The coach who is reaching out.
  coach           text,
  tweeted_at      date,
  added_by        text,
  added_by_name   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists recruits_status_idx on public.recruits (status, updated_at desc);

alter table public.recruits enable row level security;
