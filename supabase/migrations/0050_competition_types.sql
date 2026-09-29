-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — competition types in the drill bank
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The site ships with a set of competitions (first to ten, one life, …). A row
-- here either changes one of those — same key — or adds a new one of the
-- staff's own. Deleting a row puts a built-in back the way it shipped.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.competition_types (
  key         text primary key,
  label       text not null,
  -- One sentence: what it is.
  summary     text,
  setup       text,
  -- How it runs.
  how         text,
  -- Why we run it.
  why         text,
  link        text,
  link_label  text,
  board       jsonb,
  -- The drill categories it is suggested for; empty means any drill.
  fits        jsonb not null default '[]'::jsonb,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.competition_types enable row level security;
