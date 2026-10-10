-- ════════════════════════════════════════════════════════════════════════════
-- Clip order and notes
--
-- Coaches put the team's clips in the order they want them watched (dragged
-- in the Film Room's clip list) and keep notes on each. New clips go to the
-- end. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_clips add column if not exists position double precision;
alter table public.team_clips add column if not exists notes text;
update public.team_clips set position = id where position is null;
