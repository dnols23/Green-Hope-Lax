-- ════════════════════════════════════════════════════════════════════════════
-- Game stats
--
-- Every stat is an event in a game's log: "#12 shot, saved", "we won the
-- faceoff", "their clear failed". Totals, percentages and splits are never
-- stored; src/lib/stats.ts works them out from the log, so fixing one tap
-- fixes every number that depends on it.
--
--   kind          side   player_id               assist_id   result
--   shot          us     shooter                 assister    goal|saved|missed|blocked|post
--   shot          them   our goalie in the cage  —           goal|saved|missed|blocked|post
--   ground_ball   us     who got it              —           —
--   ground_ball   them   —                       —           —
--   faceoff       us     our faceoff man         —           won|lost
--   turnover      us     who gave it away        —           caused|unforced
--   turnover      them   who caused it, if any   —           caused|unforced
--   clear         us     —                       —           success|fail   (our clear)
--   clear         them   —                       —           success|fail   (their clear: our ride)
--   penalty       us     who took it             —           —   (penalty_minutes)
--   penalty       them   —                       —           —   (our man-up chance)
--
-- situation is always ours: their goal while we're a man down is 'man_down'.
-- Read and written only by the website server (service role); RLS is on with
-- no policies on purpose. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.stat_events (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  seq             bigint generated always as identity,
  period          smallint not null default 1 check (period between 1 and 8),
  side            text not null check (side in ('us', 'them')),
  kind            text not null check (kind in ('shot', 'ground_ball', 'faceoff', 'turnover', 'clear', 'penalty')),
  result          text,
  player_id       uuid references public.players(id) on delete set null,
  assist_id       uuid references public.players(id) on delete set null,
  situation       text not null default 'even' check (situation in ('even', 'man_up', 'man_down')),
  penalty_minutes numeric(3, 1) check (penalty_minutes is null or penalty_minutes between 0 and 10),
  created_by      text,
  created_at      timestamptz not null default now()
);

create index if not exists stat_events_game_idx on public.stat_events (game_id, seq);

alter table public.stat_events enable row level security;

-- The tracker names each stat before sending it, so a retry after a lost
-- reply finds the stat already saved instead of logging it twice.
alter table public.stat_events add column if not exists client_key text;
create unique index if not exists stat_events_client_key_idx on public.stat_events (game_id, client_key);
