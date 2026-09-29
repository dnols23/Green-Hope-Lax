-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — a drill can be done in more than one place
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- "Where it can be done" becomes a set: wall, on your own, with a friend, at
-- practice, watch it. Every drill starts with the one place it has now. The
-- old single `setting` column stays, kept to the drill's first take-home
-- place, for anything still reading it.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.drills add column if not exists settings text[];

update public.drills
set settings = array[coalesce(setting, 'team')]
where settings is null;
