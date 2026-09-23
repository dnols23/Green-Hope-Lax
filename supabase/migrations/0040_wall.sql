-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — On the Wall: quotes, playlists, likes
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The War Room's quote used to be one of a couple of dozen lines kept in the
-- code. Now the quotes are a library the staff adds to, and the wall plays them
-- like music: playlists, shuffle, repeat, a heart for the ones you like.
--
--   wall_quotes          Every quote. The ones that were in the code are seeded
--                        here once, each with a seed_key so re-running this
--                        never doubles them up.
--   wall_playlists       A coach's playlist. Shared ones every coach can play;
--                        private ones only the coach who made it.
--   wall_playlist_items  Which quotes are on a playlist, in order.
--   wall_likes           The heart. One row per coach per quote.
--
-- Coach-only at the database: RLS on with no policies. The server reads and
-- writes with the service role and decides who may change what.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.wall_quotes (
  id             uuid primary key default gen_random_uuid(),
  line           text        not null,
  who            text,
  added_by       text,
  added_by_name  text,
  seed_key       text unique,
  created_at     timestamptz not null default now()
);
create index if not exists wall_quotes_created_idx on public.wall_quotes (created_at);
alter table public.wall_quotes enable row level security;

create table if not exists public.wall_playlists (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null,
  description  text,
  owner_email  text        not null,
  owner_name   text,
  shared       boolean     not null default true,
  cover        text        not null default 'green',
  emoji        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists wall_playlists_owner_idx on public.wall_playlists (owner_email, created_at);
alter table public.wall_playlists enable row level security;

create table if not exists public.wall_playlist_items (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid        not null references public.wall_playlists (id) on delete cascade,
  quote_id     uuid        not null references public.wall_quotes (id) on delete cascade,
  position     double precision not null default 0,
  added_at     timestamptz not null default now(),
  unique (playlist_id, quote_id)
);
create index if not exists wall_playlist_items_order_idx on public.wall_playlist_items (playlist_id, position);
alter table public.wall_playlist_items enable row level security;

create table if not exists public.wall_likes (
  coach_email  text        not null,
  quote_id     uuid        not null references public.wall_quotes (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (coach_email, quote_id)
);
alter table public.wall_likes enable row level security;

-- The lines that used to live in the code, so the wall isn't empty on day one.
insert into public.wall_quotes (seed_key, line, who) values
  ('wall-01', 'The ball finds energy.', null),
  ('wall-02', 'Defensively, do not let the ball find energy.', null),
  ('wall-03', 'A little bit of knowledge is more dangerous than complete ignorance.', null),
  ('wall-04', 'Pressure is what you are feeling when you don’t know what’s going on.', null),
  ('wall-05', 'We don’t run around or away from anything. We run to the fight.', 'Mike Tomlin'),
  ('wall-06', 'If you can’t play together, then I’m afraid you can’t play at all.', null),
  ('wall-07', 'We tend to forget: all good things take time.', 'John Wooden'),
  ('wall-08', 'Keep it simple, stupid.', null),
  ('wall-09', 'This game is played on a five inch field, right between your ears.', null),
  ('wall-10', 'There is something magical about the sport of lacrosse when it’s collaborative.', null),
  ('wall-11', 'Stay ready, so you don’t have to get ready.', null),
  ('wall-12', 'Every now and then you get a guy with all the right stuff. There aren’t many guys like that — you gotta make them like that.', 'Nick Saban'),
  ('wall-13', 'The more you prepare, the more you’ve done it, the more ready you’ll be in a game environment.', 'Rome Odunze'),
  ('wall-14', 'You shouldn’t take a shot you haven’t taken 1000 times in practice.', 'Kobe Bryant'),
  ('wall-15', 'Invest, grow and improve.', null),
  ('wall-16', 'Grit: the ability and willingness to do any and all things necessary, regardless of circumstance.', 'Coach Ben Herbert'),
  ('wall-17', 'Humble and hungry.', null),
  ('wall-18', 'We are not building strength. We are making them harder to break.', null),
  ('wall-19', 'You have to change from doubter to believer.', null),
  ('wall-20', 'It’s amazing how much can be accomplished if no one cares who gets the credit.', null),
  ('wall-21', 'You gotta bait the hook.', 'Greg Maddux'),
  ('wall-22', 'Everyone can work harder than they think they can. Everybody’s a little better than they think they are.', 'Mike Leach'),
  ('wall-23', 'One word for all situations.', 'Bill Belichick')
on conflict (seed_key) do nothing;
