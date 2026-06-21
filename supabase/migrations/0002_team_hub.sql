-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Team Hub (private parent/player feed)
-- Run this once in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- Feed post categories (Google Classroom-style topics).
do $$ begin
  create type team_post_category as enum
    ('announcement','practice','game','forms','event','gear','general');
exception when duplicate_object then null; end $$;

-- ── team_posts: the team feed ─────────────────────────────────────────────────
create table if not exists public.team_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  category    team_post_category not null default 'announcement',
  pinned      boolean not null default false,
  event_date  timestamptz,                 -- optional: practice/game/deadline time
  attachments text,                         -- one "Label | https://url" per line
  author      text not null default 'Coach',
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists team_posts_feed_idx  on public.team_posts (pinned desc, created_at desc);
create index if not exists team_posts_event_idx on public.team_posts (event_date);

-- ── app_settings: key/value store (holds the hashed team password) ────────────
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

-- ── Security ──────────────────────────────────────────────────────────────────
-- Both tables are locked down: RLS on with NO anon/authenticated policies, so
-- only the service role (used server-side, behind the team password gate and the
-- coach admin) can read or write them. Nothing is exposed to the public API.
alter table public.team_posts   enable row level security;
alter table public.app_settings enable row level security;

-- ── Seed the initial team password ────────────────────────────────────────────
-- Initial team password is: GoFalcons2026
-- (sha256 of "GoFalcons2026:gh-falcons-v1"). Change it anytime in /admin → Team Hub.
insert into public.app_settings (key, value)
values ('team_password_hash', 'f34492156c1d3f22cb0884847a5cf15d5289f75f68c8bf35947b3f037cfc89ef')
on conflict (key) do nothing;

-- ── A couple of sample feed posts so the hub looks alive ──────────────────────
insert into public.team_posts (title, body, category, pinned, event_date, attachments, author) values
  ('Welcome to the Falcons Team Hub! 🦅',
   E'This is our private team feed — check here for everything you need this season: practice changes, game info, forms, gear, and reminders.\n\nBookmark this page and check it often. Reach out anytime through the Contact page on the main site. Go Falcons!',
   'announcement', true, null,
   'Main site | https://www.greenhopelacrosse.com', 'Coach'),
  ('Season forms due before first practice',
   E'Please complete and return the following before your player can step on the field:\n• Physical / medical clearance\n• Parent info & emergency contact\n• Player code of conduct\n\nLinks below — reach out with any questions.',
   'forms', false, null,
   E'Parent Info Packet | https://www.greenhopelacrosse.com/forms/parent-info-packet.pdf\nPhysical Form | https://www.greenhopelacrosse.com/forms/physical-form.pdf', 'Coach'),
  ('Preseason conditioning — Tuesday',
   E'Optional conditioning session at the Green Hope field. Bring cleats, water, and weather-appropriate layers. New players welcome!',
   'practice', false, '2027-02-16 17:30-05', null, 'Coach');
