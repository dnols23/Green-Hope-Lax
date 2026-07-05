-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons Lacrosse — Film Room (video board cloud storage)
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The actual video files live on Cloudflare Stream; these tables hold the tiny
-- records the whole team shares: which films exist and the clips marked on
-- them. All access goes through the website server (service role key), so RLS
-- is enabled with NO public policies on purpose — the anon key can't touch it.
-- ════════════════════════════════════════════════════════════════════════════

-- ── team_videos: the shared film library ────────────────────────────────────
create table if not exists public.team_videos (
  id          bigint generated always as identity primary key,
  uid         text        not null unique,   -- Cloudflare Stream video id
  name        text        not null,          -- original file name shown on chips
  created_at  timestamptz not null default now()
);

-- ── team_clips: marked in/out segments on a film ─────────────────────────────
create table if not exists public.team_clips (
  id          bigint generated always as identity primary key,
  video_id    bigint      not null references public.team_videos(id) on delete cascade,
  name        text        not null,
  start_time  double precision not null,
  end_time    double precision not null,
  created_at  timestamptz not null default now(),
  constraint team_clips_range check (end_time > start_time)
);

create index if not exists team_clips_video_idx on public.team_clips (video_id);

alter table public.team_videos enable row level security;
alter table public.team_clips  enable row level security;
