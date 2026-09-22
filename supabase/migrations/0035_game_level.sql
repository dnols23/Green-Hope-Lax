-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — varsity and JV games
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Until now every game was the same schedule. A JV head coach has his own
-- season — his own opponents, his own times, his own scores — and no way to
-- keep it without a column saying which team is playing.
--
-- Everything already on file is varsity, which is what it was.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.games
  add column if not exists level text not null default 'varsity';

update public.games set level = 'varsity' where level is null or level = '';

-- The schedule is read by date within a team far more often than across both.
create index if not exists games_level_date_idx
  on public.games (level, game_date);
