-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — saved competitions on a drill
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A competition that worked for a drill is kept on the drill, so the next
-- practice that runs it can pick it again in one tap.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.drills add column if not exists competitions jsonb not null default '[]'::jsonb;
