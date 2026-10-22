-- Volunteer sign-ups for each game.
--
-- A game's sign-up is an ordinary sign-up sheet that points at the game. Its
-- positions come from the head coach's list for home or away games, until he
-- changes that one game's by hand (custom). reminded_at is when a volunteer
-- was last emailed a reminder, so the daily run sends one each.

alter table public.signup_sheets add column if not exists game_id uuid references public.games (id) on delete cascade;
alter table public.signup_sheets add column if not exists custom boolean not null default false;
create unique index if not exists signup_sheets_game_idx on public.signup_sheets (game_id) where game_id is not null;

alter table public.signup_claims add column if not exists reminded_at timestamptz;
