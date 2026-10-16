-- ════════════════════════════════════════════════════════════════════════════
-- Sending clips
--
-- The head coach sends a clip to people: all the coaches, all the players (or
-- one team's), all the parents, or anyone by name. They watch it in their own
-- hub's Film Room, keep their own notes on it, and can write back.
--
--   team_clips.prompt   a question for whoever watches it, answered in a reply
--   clip_shares         who a clip is sent to — a group, or one person
--   clip_views          who has watched what (the Film Room tab pulses until)
--   clip_viewer_notes   each viewer's own notes on a clip, private to them
--   clip_messages       the conversation between one viewer and the coach
--
-- A viewer is a key: 'coach:<email>', 'player:<uuid>' or 'parent:<uuid>'.
-- Everything is read and written by the server's own key only. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_clips add column if not exists prompt text;

create table if not exists public.clip_shares (
  id          uuid primary key default gen_random_uuid(),
  clip_id     bigint not null references public.team_clips(id) on delete cascade,
  target      text not null,
  target_id   text not null default '',
  shared_by   text,
  created_at  timestamptz not null default now(),
  constraint clip_shares_target_check check (target in
    ('all_coaches', 'all_players', 'varsity_players', 'jv_players', 'all_parents', 'coach', 'player', 'parent')),
  unique (clip_id, target, target_id)
);
create index if not exists clip_shares_target_idx on public.clip_shares (target, target_id);

create table if not exists public.clip_views (
  clip_id     bigint not null references public.team_clips(id) on delete cascade,
  viewer      text not null,
  viewer_name text,
  seen_at     timestamptz not null default now(),
  primary key (clip_id, viewer)
);
create index if not exists clip_views_viewer_idx on public.clip_views (viewer);

create table if not exists public.clip_viewer_notes (
  clip_id     bigint not null references public.team_clips(id) on delete cascade,
  viewer      text not null,
  body        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (clip_id, viewer)
);

create table if not exists public.clip_messages (
  id          uuid primary key default gen_random_uuid(),
  clip_id     bigint not null references public.team_clips(id) on delete cascade,
  viewer      text not null,
  viewer_name text,
  from_coach  boolean not null default false,
  author      text,
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists clip_messages_thread_idx on public.clip_messages (clip_id, viewer, created_at);
create index if not exists clip_messages_unread_idx on public.clip_messages (from_coach, read_at);

alter table public.clip_shares enable row level security;
alter table public.clip_views enable row level security;
alter table public.clip_viewer_notes enable row level security;
alter table public.clip_messages enable row level security;
