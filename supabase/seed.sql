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
