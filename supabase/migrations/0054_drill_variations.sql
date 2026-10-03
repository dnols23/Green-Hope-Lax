-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — drill variations
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Ways to change a drill up: add a defender, go weak hand only, shrink the
-- space, make it live. Written under "Why we run it". Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.drills add column if not exists variations text;
