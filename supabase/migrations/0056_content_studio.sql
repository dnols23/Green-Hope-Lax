-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Instagram Content Studio (@ghlacrosse Reels)
--
-- ALREADY LIVE in Supabase (project ghlax). This file documents what is there
-- and can rebuild it on a fresh database; every statement is safe to re-run
-- and changes nothing that already exists.
--
--   content_series    the recipes: hook, shot list, caption formula, voice
--   content_items     each video: status, shoot day, post time, links, caption,
--                     voiceover/sfx audio paths, metrics
--   caption_snippets  reusable hooks, CTAs, sign-offs and hashtag sets
--   players.media_cleared   no video featuring a player without a release can
--                           be marked ready or posted (enforced in the app)
--   storage bucket content-audio (private): ElevenLabs mp3s, {item}/{vo|sfx}-{ts}.mp3
--
-- Signed-in staff have full access (RLS); the admin pages also check the
-- 'social' (Instagram) section before reading or writing.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Types ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.content_status as enum ('idea', 'planned', 'shot', 'editing', 'ready', 'posted', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_format as enum ('reel', 'story', 'carousel_video', 'live');
exception when duplicate_object then null; end $$;

-- ── Series ──────────────────────────────────────────────────────────────────
create table if not exists public.content_series (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  purpose            text,
  cadence            text,
  target_length_s    int,
  hook_formula       text,
  -- [{ "shot": text, "secs": int }, …]
  shot_list          jsonb not null default '[]'::jsonb,
  canva_template_url text,
  caption_formula    text,
  default_hashtags   text,
  color              text not null default '#1f4d2b',
  vo_mode            text not null default 'none'
                     check (vo_mode in ('none', 'narration', 'announcer', 'sfx_only')),
  vo_template        text,
  sort_order         int not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ── Videos ──────────────────────────────────────────────────────────────────
create table if not exists public.content_items (
  id                  uuid primary key default gen_random_uuid(),
  series_id           uuid references public.content_series(id) on delete set null,
  title               text not null,
  status              public.content_status not null default 'idea',
  format              public.content_format not null default 'reel',
  shoot_date          date,
  publish_at          timestamptz,
  posted_at           timestamptz,
  game_id             uuid references public.games(id) on delete set null,
  calendar_event_id   uuid references public.calendar_events(id) on delete set null,
  drill_id            uuid references public.drills(id) on delete set null,
  featured_player_ids uuid[] not null default '{}',
  -- [{ "shot": text, "secs": int, "done": bool }, …], copied from the series
  shot_checklist      jsonb not null default '[]'::jsonb,
  drive_folder_url    text,
  canva_design_url    text,
  final_video_url     text,
  audio_note          text,
  vo_script           text,
  vo_voice_id         text,
  vo_audio_url        text,   -- a path in the content-audio bucket
  sfx_prompt          text,
  sfx_audio_url       text,   -- a path in the content-audio bucket
  caption             text,
  hashtags            text,
  instagram_url       text,
  views               int,
  likes               int,
  shares              int,
  saves               int,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_items_status_idx  on public.content_items (status);
create index if not exists content_items_publish_idx on public.content_items (publish_at);

create or replace function public.content_items_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists content_items_touch on public.content_items;
create trigger content_items_touch before update on public.content_items
  for each row execute function public.content_items_touch();

-- ── Caption snippets ────────────────────────────────────────────────────────
create table if not exists public.caption_snippets (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('hashtags', 'cta', 'signoff', 'hook')),
  label      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ── Media releases ──────────────────────────────────────────────────────────
alter table public.players add column if not exists media_cleared boolean not null default false;

-- ── Access ──────────────────────────────────────────────────────────────────
alter table public.content_series   enable row level security;
alter table public.content_items    enable row level security;
alter table public.caption_snippets enable row level security;

drop policy if exists "admin all content_series" on public.content_series;
create policy "admin all content_series" on public.content_series
  for all to authenticated using (true) with check (true);

drop policy if exists "admin all content_items" on public.content_items;
create policy "admin all content_items" on public.content_items
  for all to authenticated using (true) with check (true);

drop policy if exists "admin all caption_snippets" on public.caption_snippets;
create policy "admin all caption_snippets" on public.caption_snippets
  for all to authenticated using (true) with check (true);

-- ── Audio storage ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('content-audio', 'content-audio', false)
on conflict (id) do nothing;

drop policy if exists "admin content-audio" on storage.objects;
create policy "admin content-audio" on storage.objects
  for all to authenticated
  using (bucket_id = 'content-audio') with check (bucket_id = 'content-audio');

-- ── Seed: the eight series ──────────────────────────────────────────────────
insert into public.content_series
  (slug, name, purpose, cadence, target_length_s, hook_formula, shot_list, caption_formula,
   default_hashtags, color, vo_mode, vo_template, sort_order)
values
  ('practice-cam', 'Practice Cam', 'Show the work. Fast, high-energy cut of one practice. Easiest weekly anchor.', 'weekly', 20, 'Start on the loudest/fastest moment (shot, check, GB scrum) — no title card.', '[{"secs": 2, "shot": "Wide establishing of the field/team breaking it down"}, {"secs": 10, "shot": "3-4 tight action clips: shots, dodges, GBs (vertical, 4K/60)"}, {"secs": 3, "shot": "Slow-mo (120/240fps) of one shot hitting net or a big check"}, {"secs": 3, "shot": "Coach whistle / huddle break / ''1-2-3 Falcons''"}]'::jsonb, E'[One-line vibe]. [Day] work. 🦅\n\n[CTA]', '#GreenHopeLacrosse #Falcons #CaryNC #NCHSLax', '#1f4d2b', 'sfx_only', null, 10),
  ('drill-of-the-week', 'Drill of the Week', 'Teach one drill from the site drill library. Builds credibility with youth/Green Machine families and is highly saveable.', 'weekly', 30, 'On-screen text: "Our [position] do this every practice 👇" over the drill at full speed.', '[{"secs": 5, "shot": "Drill at full speed, one rep, wide"}, {"secs": 8, "shot": "Same drill from behind/POV, slower"}, {"secs": 8, "shot": "Coach 1-sentence teaching point to camera (lav or phone close)"}, {"secs": 4, "shot": "Best rep, slow-mo"}, {"secs": 3, "shot": "End card: drill name + greenhopelacrosse.com"}]'::jsonb, E'Drill of the Week: [Drill name]\n\nWhy we run it: [1 line]\nKey coaching point: [1 line]\n\nSave this for your next wall-ball session. More drills → link in bio.', '#LacrosseDrills #GreenHopeLacrosse #LaxTraining', '#2e6b3f', 'narration', 'Drill of the week. [Drill name]. [Why we run it, one sentence]. [Key coaching point]. Save this one.', 20),
  ('player-spotlight', 'Player Spotlight: 3 Questions', 'Let players be the face of the program. Rapid-fire Q&A, 1 player per video.', 'biweekly', 30, 'Player says their name + position, then cut straight to Q1 answer.', '[{"secs": 4, "shot": "Player intro: name, grade, position (helmet off, eye level, quiet spot)"}, {"secs": 7, "shot": "Q1: Best part of being a Falcon?"}, {"secs": 7, "shot": "Q2: Pre-game routine / walkout song?"}, {"secs": 7, "shot": "Q3: Who on the team makes you better?"}, {"secs": 5, "shot": "B-roll of player in a drill"}]'::jsonb, E'Get to know [First name] — [grade] [position]. 🦅\n\n[best quote]\n\n[CTA]', '#GreenHopeLacrosse #Falcons #PlayerSpotlight', '#7a1f2b', 'none', null, 30),
  ('coachs-word', 'Coach''s Word', 'Culture in 20 seconds. One idea, one sentence of language the team uses (adversity, ownership, "find your guy").', 'biweekly', 20, 'Open mid-sentence on the key line, then context.', '[{"secs": 10, "shot": "Coach talking to team in huddle (shoot over players'' shoulders)"}, {"secs": 5, "shot": "Cutaways: players reacting, hands in"}, {"secs": 3, "shot": "Text card of the key line"}]'::jsonb, E'"[Key line]."\n\n[1-2 sentences of context]', '#GreenHopeLacrosse #TeamCulture', '#111111', 'none', null, 40),
  ('grind', 'Offseason Grind', 'Weight room, open fields, early mornings. Shows commitment between seasons.', 'weekly (offseason)', 15, 'Bar slam / sprint finish in first frame.', '[{"secs": 10, "shot": "3-5 quick lifts / sprints / wall ball reps, 1-2s each"}, {"secs": 2, "shot": "Clock or sunrise/lights shot to show the time"}, {"secs": 3, "shot": "Team break"}]'::jsonb, 'Nobody sees this part. [Date range] → spring. 🦅', '#Offseason #GreenHopeLacrosse', '#333333', 'sfx_only', null, 50),
  ('back-in-black', 'Back in Black (Uniform Reveal)', '2026-27 campaign: matte black helmets + black uniforms. 3 teasers then the reveal.', 'campaign', 20, 'Darkness → one detail lit (logo, facemask, number) — never the full look until reveal.', '[{"secs": 6, "shot": "Teaser 1: black screen, helmet silhouette, single light sweep"}, {"secs": 8, "shot": "Teaser 2: macro details — matte finish, decal, stitching"}, {"secs": 8, "shot": "Teaser 3: players walking in, backlit, faces hidden"}, {"secs": 15, "shot": "Reveal: full uniform, slow walk to camera, lights up"}]'::jsonb, E'Teasers: "[date]." only.\nReveal: Back in Black. 🖤 2026-27 Falcons.', '#BackInBlack #GreenHopeLacrosse #Falcons', '#000000', 'announcer', 'Twenty twenty-six. The Falcons go back... to black.', 60),
  ('game-day', 'Game Day', 'Spring season: hype before, result after. Links to the games table.', 'per game', 15, 'Pre: "GAME DAY" + opponent over walkout. Post: final score first frame.', '[{"secs": 8, "shot": "PRE — bus/locker/walkout, warmups"}, {"secs": 4, "shot": "PRE — score card: opponent, time, location (Canva)"}, {"secs": 3, "shot": "POST — final score card"}, {"secs": 15, "shot": "POST — 3-5 goal/save clips (from parents/Hudl)"}, {"secs": 3, "shot": "POST — postgame celebration/huddle"}]'::jsonb, E'PRE: Game day vs [Opponent]. [Time] @ [Location]. Come loud. 🦅\nPOST: Falcons [W/L] [score] vs [Opponent]. [1 standout line].', '#GameDay #GreenHopeLacrosse #NCHSLax', '#1f4d2b', 'announcer', 'It''s game day. Green Hope Falcons versus [Opponent]. [Time]. [Location]. Be loud.', 70),
  ('green-machine', 'Green Machine', 'Middle school feeder program. Shows youth families the pathway.', 'monthly', 20, 'Varsity player + middle schooler side by side doing the same move.', '[{"secs": 8, "shot": "Green Machine kids in a drill"}, {"secs": 8, "shot": "Varsity player helping/coaching a younger player"}, {"secs": 3, "shot": "End card: Join the Green Machine → greenhopelacrosse.com"}]'::jsonb, 'Future Falcons. 🦅 Grades 6-8 → Join the Green Machine (link in bio).', '#GreenMachine #YouthLacrosse #CaryNC', '#3b8a4e', 'none', null, 80)
on conflict (slug) do nothing;
-- (on conflict: a series already there is left exactly as the staff edited it)

-- ── Seed: caption snippets ──────────────────────────────────────────────────
insert into public.caption_snippets (kind, label, body)
select v.kind, v.label, v.body
from (values
  ('hashtags', 'Core', '#GreenHopeLacrosse #Falcons #GHLax #CaryNC #NCHSLax'),
  ('hashtags', 'Youth', '#GreenMachine #YouthLacrosse #FutureFalcons'),
  ('cta', 'Site', 'More at greenhopelacrosse.com (link in bio)'),
  ('cta', 'Join', 'Grades 6-8? Join the Green Machine — link in bio.'),
  ('cta', 'Follow', 'Follow along all season 🦅'),
  ('signoff', 'Falcons', '🦅 #FalconsFly')
) as v(kind, label, body)
where not exists (select 1 from public.caption_snippets c where c.kind = v.kind and c.label = v.label);

-- The 14 starting videos (Oct–Nov 2026) were added straight to the live
-- database as working data; they aren't re-created here.
