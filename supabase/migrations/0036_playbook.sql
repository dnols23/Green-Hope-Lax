-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — the Playbook
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The Library is a shelf: everything anybody kept, in case. The Playbook is
-- what we are actually running — a deck of pages, in order, each one a play off
-- the board with the title, the reads and the coaching points written around
-- it. Varsity and JV keep their own.
--
-- Written by the head coach alone. Read by the staff, and by the players, only
-- once he publishes it — a half-installed playbook in a player's hands is worse
-- than no playbook.
--
-- Coach-only at the database: RLS on with no anon or authenticated policies.
-- What a player may see is decided by the server, which reads these rows with
-- the service role and hands over only a published deck.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.playbook_pages (
  id         uuid primary key default gen_random_uuid(),
  team       text        not null default 'varsity',
  sort_order int         not null default 0,
  title      text        not null default '',
  -- The page itself: an ordered list of blocks — a play, a screenshot, a
  -- heading, a paragraph, a list of points. See src/lib/playbook.ts.
  blocks     jsonb       not null default '[]'::jsonb,
  -- Side by side, or one thing under another.
  layout     text        not null default 'split',
  -- What you say while it is on the screen. Never shown to players.
  notes      text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playbook_pages_team_idx
  on public.playbook_pages (team, sort_order);

alter table public.playbook_pages enable row level security;

-- A play can be dropped onto a page. Deleting the play should empty the block,
-- not delete the page it was on, so the reference is deliberately loose: pages
-- hold the play's id inside `blocks`, and a missing play renders as a gap the
-- head coach can see and fix.
