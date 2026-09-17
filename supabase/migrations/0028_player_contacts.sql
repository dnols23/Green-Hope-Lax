-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — who to call
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Deliberately NOT columns on `players`. That table is read by the public
-- roster page, which means anything on it is readable by anyone with the site's
-- anon key — fine for a jersey number, not for a parent's mobile or a child's
-- emergency contact.
--
-- This table has RLS on with no anon or authenticated policies at all: it is
-- reachable only through the server, on coach-only screens.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.player_contacts (
  player_id        uuid primary key references public.players (id) on delete cascade,
  player_email     text,
  player_phone     text,
  guardian_name    text,
  guardian_email   text,
  guardian_phone   text,
  guardian2_name   text,
  guardian2_email  text,
  guardian2_phone  text,
  -- Who to call first when something happens on the field.
  emergency_name   text,
  emergency_phone  text,
  emergency_relation text,
  /** 'guardian' | 'guardian2' | 'emergency' — which of the above to try first. */
  preferred        text,
  notes            text,
  updated_at       timestamptz not null default now(),
  updated_by       text
);

alter table public.player_contacts enable row level security;
