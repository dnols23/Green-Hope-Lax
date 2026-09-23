-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — the calendar
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The schedule was a list of games. A season is more than games: film sessions,
-- team dinners, the bus time, the fundraiser, the parents' meeting — and the
-- one thing a head coach most needs before he plans any of it, which is which
-- of his coaches can actually be there.
--
-- Two tables:
--
--   calendar_events     Anything the head coach (or a team's head coach) puts
--                       on the calendar, with who may see it: coaches only,
--                       coaches and players, parents, or everyone.
--
--   coach_availability  A coach saying "I can't do Tuesdays" or "I'm out the
--                       14th to the 18th" — or that he *can* do a Saturday. One
--                       block, or the same block every week until a date.
--
-- Games and practice plans are not copied in here; the calendar reads them
-- where they already live, so there is one place to change each.
--
-- Coach-only at the database: RLS on with no anon or authenticated policies.
-- What a player, a parent or the public sees is decided by the server, which
-- reads these rows with the service role and hands over only what that
-- audience may see.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  -- varsity | jv | program
  team        text        not null default 'program',
  title       text        not null,
  -- event | meeting | practice | travel | film | social | fundraiser | deadline
  kind        text        not null default 'event',
  starts_at   timestamptz not null,
  -- Exclusive. For an all-day event, midnight after the last day.
  ends_at     timestamptz not null,
  all_day     boolean     not null default false,
  location    text,
  notes       text,
  -- coaches | team | parents | public
  audience    text        not null default 'coaches',
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_order check (ends_at >= starts_at)
);

create index if not exists calendar_events_range_idx
  on public.calendar_events (starts_at, ends_at);
create index if not exists calendar_events_audience_idx
  on public.calendar_events (audience, starts_at);

alter table public.calendar_events enable row level security;

create table if not exists public.coach_availability (
  id            uuid primary key default gen_random_uuid(),
  coach_email   text        not null,
  coach_name    text        not null default '',
  -- available | unavailable
  status        text        not null default 'unavailable',
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  all_day       boolean     not null default false,
  -- The same block every week, until repeat_until (inclusive) or for ever.
  repeat_weekly boolean     not null default false,
  repeat_until  date,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint coach_availability_order check (ends_at >= starts_at)
);

create index if not exists coach_availability_coach_idx
  on public.coach_availability (coach_email, starts_at);
create index if not exists coach_availability_range_idx
  on public.coach_availability (starts_at, ends_at);

alter table public.coach_availability enable row level security;
