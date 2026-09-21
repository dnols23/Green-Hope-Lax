-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — what time practice starts
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The planner has always had a Starts box, and moving it re-times the whole
-- plan on screen — but there was nowhere to keep it, so every plan opened back
-- at four o'clock and the War Room and the players' page said four o'clock
-- whatever the plan said.
--
-- Kept as text in 24-hour "HH:MM", which is exactly what the browser's time box
-- hands over and hands back. Nothing is a time zone problem: a practice starts
-- at half four wherever the server happens to be.
--
-- Plans written before this have no start time and go on behaving as they did,
-- starting at 4:00 PM.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists start_time text;
