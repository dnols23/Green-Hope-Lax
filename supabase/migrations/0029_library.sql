-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — the Library: recorded plays and board screenshots
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Two things:
--   1. A saved play can now carry a recording — the whole board at each moment
--      it changed while the coach was drawing it, so it plays back rather than
--      sitting there as a still.
--   2. Screenshots taken off the board get a row here, so the Library page can
--      list them and any practice plan, note or game plan can pull one in.
--
-- Coach-only: RLS on with no anon or authenticated policies, the same as plays.
-- The image itself lives in the public media bucket, like every other photo on
-- the site.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Recordings ─────────────────────────────────────────────────────────────
alter table public.plays add column if not exists clip jsonb;

-- 2. Screenshots ────────────────────────────────────────────────────────────
create table if not exists public.library_items (
  id         uuid primary key default gen_random_uuid(),
  kind       text        not null default 'shot',   -- room for clips of film later
  title      text        not null default '',
  url        text        not null,
  note       text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists library_items_created_idx
  on public.library_items (created_at desc);

alter table public.library_items enable row level security;
