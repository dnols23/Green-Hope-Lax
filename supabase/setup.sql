-- Green Hope Falcons — full setup (schema + seed). Run once.

-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons Lacrosse — initial schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────
-- Which roster a player belongs to.
do $$ begin
  create type team_group as enum ('boys_varsity', 'boys_jv', 'girls');
exception when duplicate_object then null; end $$;

-- Boys vs Girls program (used by schedule, coaches, interest form).
do $$ begin
  create type program_gender as enum ('boys', 'girls');
exception when duplicate_object then null; end $$;

-- Home / Away / Neutral for games.
do $$ begin
  create type home_away as enum ('home', 'away', 'neutral');
exception when duplicate_object then null; end $$;

-- Lifecycle of a game.
do $$ begin
  create type game_status as enum ('scheduled', 'final', 'postponed', 'canceled');
exception when duplicate_object then null; end $$;

-- Player experience level on the interest form.
do $$ begin
  create type experience_level as enum ('new', 'some', 'experienced');
exception when duplicate_object then null; end $$;


-- ── players ──────────────────────────────────────────────────────────────────
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  team        team_group  not null default 'boys_varsity',
  name        text        not null,
  number      text,                       -- jersey number, text so "00" works
  position    text,                       -- Attack, Midfield, Defense, Goalie, LSM, FOGO…
  class_year  text,                       -- e.g. "2027" or "Sophomore"
  height      text,
  hometown    text,
  bio         text,
  photo_url   text,
  sort_order  int         not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ── games ────────────────────────────────────────────────────────────────────
create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  gender      program_gender not null default 'boys',
  game_date   timestamptz    not null,
  opponent    text           not null,
  home_away   home_away      not null default 'home',
  location    text,
  status      game_status    not null default 'scheduled',
  team_score  int,                        -- Green Hope's score (once played)
  opp_score   int,                        -- opponent's score
  is_conference boolean      not null default true,
  notes       text,
  created_at  timestamptz    not null default now()
);

-- ── coaches ──────────────────────────────────────────────────────────────────
create table if not exists public.coaches (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  role        text        not null default 'Assistant Coach',
  program     program_gender,             -- null = applies to whole program
  email       text,
  phone       text,
  bio         text,
  photo_url   text,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

-- ── news_posts ───────────────────────────────────────────────────────────────
create table if not exists public.news_posts (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null,
  slug         text        unique not null,
  body         text        not null default '',
  image_url    text,
  published    boolean     not null default true,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ── interest_form_submissions ────────────────────────────────────────────────
create table if not exists public.interest_form_submissions (
  id            uuid primary key default gen_random_uuid(),
  player_first  text             not null,
  player_last   text             not null,
  grad_year     text,
  parent_name   text             not null,
  parent_email  text             not null,
  parent_phone  text             not null,
  player_email  text,
  experience    experience_level not null default 'new',
  program       program_gender   not null default 'boys',
  notes         text,
  created_at    timestamptz      not null default now()
);

-- ── contact_submissions ──────────────────────────────────────────────────────
create table if not exists public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  email       text        not null,
  message     text        not null,
  created_at  timestamptz not null default now()
);


-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
--   Public (anon) can:   read published content, insert form submissions.
--   Authenticated admin: full read/write on everything.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.players                   enable row level security;
alter table public.games                     enable row level security;
alter table public.coaches                   enable row level security;
alter table public.news_posts                enable row level security;
alter table public.interest_form_submissions enable row level security;
alter table public.contact_submissions       enable row level security;

-- ── Public read policies ──────────────────────────────────────────────────────
-- Roster, schedule, and staff are public info.
drop policy if exists "public read players" on public.players;
create policy "public read players" on public.players
  for select to anon, authenticated using (true);

drop policy if exists "public read games" on public.games;
create policy "public read games" on public.games
  for select to anon, authenticated using (true);

drop policy if exists "public read coaches" on public.coaches;
create policy "public read coaches" on public.coaches
  for select to anon, authenticated using (true);

-- News: anon sees only published posts; admins see everything.
drop policy if exists "public read published news" on public.news_posts;
create policy "public read published news" on public.news_posts
  for select to anon using (published = true);

drop policy if exists "admin read all news" on public.news_posts;
create policy "admin read all news" on public.news_posts
  for select to authenticated using (true);

-- ── Public insert policies (form submissions) ─────────────────────────────────
-- Anyone can submit the interest form / contact form, but nobody anonymous can
-- read them back (no select policy for anon = no reads).
drop policy if exists "public insert interest" on public.interest_form_submissions;
create policy "public insert interest" on public.interest_form_submissions
  for insert to anon, authenticated with check (true);

drop policy if exists "public insert contact" on public.contact_submissions;
create policy "public insert contact" on public.contact_submissions
  for insert to anon, authenticated with check (true);

-- ── Admin (authenticated) full-write policies ─────────────────────────────────
-- An authenticated user is, by design, an admin you created in the Supabase
-- dashboard. They can do anything on every table.
do $$
declare t text;
begin
  foreach t in array array[
    'players','games','coaches','news_posts',
    'interest_form_submissions','contact_submissions'
  ] loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s;', t);
    execute format(
      'create policy "admin all %1$s" on public.%1$s
         for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ── Helpful indexes ───────────────────────────────────────────────────────────
create index if not exists players_team_idx        on public.players (team, sort_order);
create index if not exists games_date_idx           on public.games (game_date);
create index if not exists games_gender_idx         on public.games (gender, game_date);
create index if not exists news_published_idx       on public.news_posts (published, published_at desc);
create index if not exists interest_created_idx     on public.interest_form_submissions (created_at desc);
create index if not exists contact_created_idx      on public.contact_submissions (created_at desc);


-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — seed / sample data
-- Safe to re-run: it clears the content tables first, then re-inserts.
-- It does NOT touch interest_form_submissions / contact_submissions.
-- Run after 0001_init.sql in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

truncate table public.players, public.games, public.coaches, public.news_posts restart identity;

-- ── Games ────────────────────────────────────────────────────────────────────
-- A few finished 2026 results + upcoming 2027 (Southwest Wake 4A) games so the
-- schedule, "Next Game" card, and results layout all have data to show.
insert into public.games (gender, game_date, opponent, home_away, location, status, team_score, opp_score, is_conference, notes) values
  -- Boys — finished
  ('boys', '2026-03-10 19:00-04', 'Cary',            'home', 'Green Hope HS', 'final', 14, 6,  true,  'Conference opener'),
  ('boys', '2026-03-13 19:00-04', 'Holly Springs',   'away', 'Holly Springs HS', 'final', 9, 11, true,  null),
  ('boys', '2026-03-20 19:00-04', 'Panther Creek',   'home', 'Green Hope HS', 'final', 12, 8,  true,  'Senior night'),
  ('boys', '2026-03-27 19:00-04', 'Apex',            'away', 'Apex HS', 'final', 7, 10, true,  null),
  -- Boys — upcoming (2027 season)
  ('boys', '2027-02-24 19:00-05', 'Middle Creek',    'home', 'Green Hope HS', 'scheduled', null, null, true, null),
  ('boys', '2027-02-27 18:00-05', 'Green Level',     'away', 'Green Level HS', 'scheduled', null, null, true, null),
  ('boys', '2027-03-03 19:00-05', 'Apex Friendship', 'home', 'Green Hope HS', 'scheduled', null, null, true, null),
  ('boys', '2027-03-06 13:00-05', 'Broughton',       'away', 'Broughton HS', 'scheduled', null, null, false, 'Non-conference'),
  ('boys', '2027-03-10 19:00-05', 'Wake Forest',     'home', 'Green Hope HS', 'scheduled', null, null, false, null);

-- ── Coaches ──────────────────────────────────────────────────────────────────
insert into public.coaches (name, role, program, email, phone, bio, sort_order) values
  ('Head Coach',         'Head Coach',             'boys',  'coach@greenhopelacrosse.com',  '(919) 555-0101', 'Leads the Green Hope boys lacrosse program. Replace this bio in the admin panel.', 1),
  ('Assistant Coach',    'Assistant Coach',        'boys',  null, null, 'Add your assistant coaches and their bios from /admin.', 3),
  ('Team Manager',       'Program Coordinator',    null,    'info@greenhopelacrosse.com', null, 'Handles scheduling, communications, and team logistics.', 4);

-- ── Roster (sample players) ───────────────────────────────────────────────────
insert into public.players (team, name, number, position, class_year, height, hometown, sort_order) values
  -- Boys Varsity
  ('boys_varsity', 'Player One',   '1',  'Attack',   '2027', '5''11"', 'Cary, NC', 1),
  ('boys_varsity', 'Player Two',   '7',  'Midfield', '2026', '6''0"',  'Cary, NC', 2),
  ('boys_varsity', 'Player Three', '21', 'Defense',  '2027', '6''2"',  'Morrisville, NC', 3),
  ('boys_varsity', 'Player Four',  '00', 'Goalie',   '2028', '5''10"', 'Cary, NC', 4),
  ('boys_varsity', 'Player Five',  '15', 'FOGO',     '2026', '5''9"',  'Apex, NC', 5),
  ('boys_varsity', 'Player Six',   '33', 'LSM',      '2027', '6''1"',  'Cary, NC', 6),
  -- Boys JV
  ('boys_jv', 'JV Player One', '4',  'Attack',   '2029', null, 'Cary, NC', 1),
  ('boys_jv', 'JV Player Two', '12', 'Midfield', '2029', null, 'Cary, NC', 2),
  ('boys_jv', 'JV Player Three','9', 'Defense',  '2030', null, 'Morrisville, NC', 3);

-- ── News / announcements ──────────────────────────────────────────────────────
insert into public.news_posts (title, slug, body, published, published_at) values
  ('Welcome to the new Falcons Lacrosse site',
   'welcome-to-the-new-site',
   E'We''re excited to launch the official home of Green Hope Falcons lacrosse. Here you''ll find the schedule, rosters, news, and everything you need to join the team.\n\nCheck back often for updates throughout the season. Go Falcons!',
   true, '2026-06-01 09:00-04'),
  ('2027 interest form is open',
   '2027-interest-form-open',
   E'Thinking about playing lacrosse next season? New and experienced players are welcome.\n\nFill out the Join the Team interest form and a coach will reach out with tryout and offseason information.',
   true, '2026-06-10 12:00-04'),
  ('Offseason workouts & summer info',
   'offseason-workouts-summer-info',
   E'Summer is the time to get better. We''ll post open-field dates, conditioning sessions, and recommended camps here.\n\nGear questions? Reach out through the Contact page.',
   true, '2026-06-18 08:00-04');
