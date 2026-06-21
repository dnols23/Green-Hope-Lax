-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — seed / sample data
-- Safe to re-run: it clears the content tables first, then re-inserts.
-- It does NOT touch interest_form_submissions / contact_submissions.
-- Run after 0001_init.sql in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

truncate table public.players, public.games, public.coaches, public.news_posts restart identity;

-- ── Games ────────────────────────────────────────────────────────────────────
-- Green Hope Falcons 2026 boys lacrosse season (full results, from MaxPreps).
-- Scores are entered Green Hope-first (team_score) regardless of W/L. Conference
-- games carry is_conference = true (Southwest Wake + conference tournament).
-- Times: EST (-05) before the Mar 8 2026 DST change, EDT (-04) after.
insert into public.games (gender, game_date, opponent, home_away, location, status, team_score, opp_score, is_conference, notes) values
  ('boys', '2026-02-27 17:00-05', 'Holly Springs',   'away', 'Holly Springs HS',   'final', 11, 16, false, null),
  ('boys', '2026-03-05 18:30-05', 'Leesville Road',  'away', 'Leesville Road HS',  'final', 10, 6,  false, null),
  ('boys', '2026-03-06 19:00-05', 'CHHS',            'away', 'CHHS',               'final', 15, 4,  false, null),
  ('boys', '2026-03-10 18:30-04', 'Athens Drive',    'away', 'Athens Drive HS',    'final', 15, 16, false, 'Overtime'),
  ('boys', '2026-03-11 17:00-04', 'Felton Grove',    'away', 'Felton Grove HS',    'final', 17, 16, false, null),
  ('boys', '2026-03-13 18:30-04', 'Apex Friendship', 'home', 'Green Hope HS',      'final', 8,  13, true,  null),
  ('boys', '2026-03-17 18:30-04', 'Apex',            'home', 'Green Hope HS',      'final', 7,  16, true,  null),
  ('boys', '2026-03-20 19:00-04', 'Jordan',          'away', 'Jordan HS',          'final', 13, 7,  true,  null),
  ('boys', '2026-03-24 17:00-04', 'Panther Creek',   'away', 'Panther Creek HS',   'final', 18, 4,  true,  null),
  ('boys', '2026-03-25 18:00-04', 'Ravenscroft',     'home', 'Green Hope HS',      'final', 18, 6,  false, null),
  ('boys', '2026-03-27 17:00-04', 'Willow Spring',   'home', 'Green Hope HS',      'final', 9,  8,  true,  null),
  ('boys', '2026-04-07 19:00-04', 'Heritage',        'home', 'Green Hope HS',      'final', 16, 15, false, null),
  ('boys', '2026-04-08 18:30-04', 'Fuquay-Varina',   'home', 'Green Hope HS',      'final', 20, 2,  false, null),
  ('boys', '2026-04-10 18:30-04', 'Green Level',     'away', 'Green Level HS',     'final', 11, 19, true,  null),
  ('boys', '2026-04-13 19:00-04', 'Cary',            'home', 'Green Hope HS',      'final', 20, 1,  false, null),
  ('boys', '2026-04-14 18:30-04', 'Apex Friendship', 'away', 'Apex Friendship HS', 'final', 5,  20, true,  null),
  ('boys', '2026-04-16 18:30-04', 'Apex',            'away', 'Apex HS',            'final', 9,  14, true,  null),
  ('boys', '2026-04-20 18:30-04', 'Willow Spring',   'away', 'Willow Spring HS',   'final', 11, 10, true,  null),
  ('boys', '2026-04-21 18:30-04', 'Jordan',          'home', 'Green Hope HS',      'final', 15, 12, true,  null),
  ('boys', '2026-04-24 18:30-04', 'Panther Creek',   'home', 'Green Hope HS',      'final', 19, 4,  true,  null),
  ('boys', '2026-04-30 18:30-04', 'Middle Creek',    'home', 'Green Hope HS',      'final', 8,  18, false, null),
  ('boys', '2026-05-05 18:30-04', 'Green Level',     'home', 'Green Hope HS',      'final', 3,  11, true,  null),
  ('boys', '2026-05-12 19:30-04', 'Jordan',          'home', 'Green Hope HS',      'final', 16, 7,  true,  'Playoffs'),
  ('boys', '2026-05-15 19:00-04', 'Apex Friendship', 'away', 'Apex Friendship HS', 'final', 12, 19, true,  'Playoffs');

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
