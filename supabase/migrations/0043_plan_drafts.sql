-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — private drafts in the planner
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A JV assistant's plans are his own: nobody else sees them, and they never
-- reach a War Room, the calendar or the players. He can send one to the head
-- coaches for review; a head coach can then move it into the team's planner.
--
--   private             — only its author (and, once sent, the head coaches) see it
--   review_requested_at — when the author sent it for review; null if not sent
--
-- Every existing plan stays exactly as it is (not private). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans add column if not exists private boolean not null default false;
alter table public.plans add column if not exists review_requested_at timestamptz;
