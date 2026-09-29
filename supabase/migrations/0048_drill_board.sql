-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — a field diagram on each drill
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The diagram belongs to the drill, like its setup and its video, so every
-- practice that uses the drill shows it under "What this drill is".
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.drills add column if not exists board jsonb;
