-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — who each game is for
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- One schedule, three audiences. A game marked:
--   public   — the public schedule, the Team Hub, and the admin (the default)
--   team     — the Team Hub and the admin, but not the public site
--   coaches  — the admin only
--
-- Everything already in the table becomes 'public', which is exactly what it is
-- today, so running this changes nothing until a game is marked otherwise.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.games
  add column if not exists audience text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_audience_check'
  ) then
    alter table public.games
      add constraint games_audience_check
      check (audience in ('public', 'team', 'coaches'));
  end if;
end $$;

create index if not exists games_audience_idx on public.games (audience);
