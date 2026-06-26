-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — load the 2026 BOYS varsity season results (from MaxPreps)
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- This updates the LIVE site. It only touches boys games dated in 2026; it does
-- NOT affect girls games, the roster, news, coaches, or any other data.
-- Safe to re-run (it clears 2026 boys games first, then re-inserts).
--
-- Final record: 14–10 overall, 6–6 conference (the /stats page computes this
-- from these rows automatically). Result convention below:
--   team_score = Green Hope's score, opp_score = opponent's score.
-- Conference (Southwest Wake / SWAC) games are flagged is_conference = true;
-- non-conference and the two NCHSAA playoff games are false.
-- ════════════════════════════════════════════════════════════════════════════

delete from public.games
where gender = 'boys'
  and game_date >= '2026-01-01' and game_date < '2027-01-01';

insert into public.games (gender, game_date, opponent, home_away, location, status, team_score, opp_score, is_conference, notes) values
  ('boys', '2026-02-27 17:00-05', 'Holly Springs',   'away', null,            'final', 11, 16, false, null),
  ('boys', '2026-03-05 18:30-05', 'Leesville Road',  'away', null,            'final', 10, 6,  false, null),
  ('boys', '2026-03-06 19:00-05', 'CHHS',            'away', null,            'final', 15, 4,  false, null),
  ('boys', '2026-03-10 18:30-04', 'Athens Drive',    'away', null,            'final', 15, 16, false, 'Overtime'),
  ('boys', '2026-03-11 17:00-04', 'Felton Grove',    'away', null,            'final', 17, 16, false, null),
  ('boys', '2026-03-13 18:30-04', 'Apex Friendship', 'home', 'Green Hope HS', 'final', 8,  13, true,  null),
  ('boys', '2026-03-17 18:30-04', 'Apex',            'home', 'Green Hope HS', 'final', 7,  16, true,  null),
  ('boys', '2026-03-20 19:00-04', 'Jordan',          'away', null,            'final', 13, 7,  true,  null),
  ('boys', '2026-03-24 17:00-04', 'Panther Creek',   'away', null,            'final', 18, 4,  true,  null),
  ('boys', '2026-03-25 18:00-04', 'Ravenscroft',     'home', 'Green Hope HS', 'final', 18, 6,  false, null),
  ('boys', '2026-03-27 17:00-04', 'Willow Spring',   'home', 'Green Hope HS', 'final', 9,  8,  true,  null),
  ('boys', '2026-04-07 19:00-04', 'Heritage',        'home', 'Green Hope HS', 'final', 16, 15, false, null),
  ('boys', '2026-04-08 18:30-04', 'Fuquay-Varina',   'home', 'Green Hope HS', 'final', 20, 2,  false, null),
  ('boys', '2026-04-10 18:30-04', 'Green Level',     'away', null,            'final', 11, 19, true,  null),
  ('boys', '2026-04-13 19:00-04', 'Cary',            'home', 'Green Hope HS', 'final', 20, 1,  false, null),
  ('boys', '2026-04-14 18:30-04', 'Apex Friendship', 'away', null,            'final', 5,  20, true,  null),
  ('boys', '2026-04-16 18:30-04', 'Apex',            'away', null,            'final', 9,  14, true,  null),
  ('boys', '2026-04-20 18:30-04', 'Willow Spring',   'away', null,            'final', 11, 10, true,  null),
  ('boys', '2026-04-21 18:30-04', 'Jordan',          'home', 'Green Hope HS', 'final', 15, 12, true,  null),
  ('boys', '2026-04-24 18:30-04', 'Panther Creek',   'home', 'Green Hope HS', 'final', 19, 4,  true,  null),
  ('boys', '2026-04-30 18:30-04', 'Middle Creek',    'home', 'Green Hope HS', 'final', 8,  18, false, null),
  ('boys', '2026-05-05 18:30-04', 'Green Level',     'home', 'Green Hope HS', 'final', 3,  11, true,  null),
  ('boys', '2026-05-12 19:30-04', 'Jordan',          'home', 'Green Hope HS', 'final', 16, 7,  false, 'NCHSAA Playoffs — First Round'),
  ('boys', '2026-05-15 19:00-04', 'Apex Friendship', 'away', null,            'final', 12, 19, false, 'NCHSAA Playoffs — Second Round');
