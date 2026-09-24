-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — scouts that save, and game plans that are game plans
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- 1. The planner's list of kinds only ever allowed practice, game and note, so
--    every "New scout" was turned away by the database without a word. Scouts
--    are allowed now.
--
-- 2. A game plan is not a practice. It is how we are going to play one
--    opponent: what we are in on offense, defense, the ride and the clear, who
--    starts where, what each coach is responsible for, and the game-day
--    schedule from arrival to the opening faceoff. All of that lives in one
--    column, `details`, read and checked by src/lib/gamePlan.ts.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans drop constraint if exists plans_kind_check;
alter table public.plans
  add constraint plans_kind_check check (kind in ('practice', 'game', 'note', 'scout'));

alter table public.plans
  add column if not exists details jsonb not null default '{}'::jsonb;
