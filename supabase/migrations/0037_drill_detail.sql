-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — what a drill is, and who is winning practice
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A JV coach handed a practice plan gets a list of drill names and a number of
-- minutes. He does not know how the drill is set up, what it is for, or what
-- good looks like — so he runs it badly or not at all.
--
-- Two columns fix that: how to set it up, and why we run it. The video link the
-- drill already had is the third thing, and between them a coach who has never
-- seen a drill can run it off the plan.
--
-- Then `sides` on a plan: the two squads a practice is split into, so every
-- drill can be scored and the whole practice adds up to somebody winning it.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- How you set it up: cones, lines, how many balls, where the goalie stands.
alter table public.drills add column if not exists setup text;

-- Why we run it and what good looks like — the thing a coach needs to coach it
-- rather than just start it.
alter table public.drills add column if not exists context text;

-- The two squads this practice is split into. Two by default, but a coach who
-- wants three has three.
alter table public.plans add column if not exists sides jsonb not null default '["Blue","White"]'::jsonb;
