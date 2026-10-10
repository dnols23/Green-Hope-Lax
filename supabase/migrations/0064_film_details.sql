-- ════════════════════════════════════════════════════════════════════════════
-- Film details
--
-- What a team film is and where it's kept, filled in when it's uploaded (and
-- changeable from the Library): a type (game, practice, scouting…), the game
-- on the schedule it's from, a folder, and notes. The Library files each film
-- under its folder, else its game. Keys in src/components/videoboard/filmMeta.ts.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_videos add column if not exists category text not null default 'game';
alter table public.team_videos add column if not exists game_id uuid references public.games(id) on delete set null;
alter table public.team_videos add column if not exists folder text;
alter table public.team_videos add column if not exists notes text;

do $$ begin
  alter table public.team_videos add constraint team_videos_category_check
    check (category in ('game', 'practice', 'scout', 'highlights', 'teaching', 'other'));
exception when duplicate_object then null; end $$;

create index if not exists team_videos_game_idx on public.team_videos (game_id);
