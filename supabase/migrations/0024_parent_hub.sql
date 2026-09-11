-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Parent Hub
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The parents' own door into the program. One link, sent in a team email; a
-- parent follows it once, says who they are, and is in from then on. No shared
-- password to leak and no account for anybody to administer.
--
-- What's inside it is sign-up sheets — who is bringing water to Barton, who is
-- driving, who is working the table. A coach makes them, and so can any parent
-- the coach marks as a team parent, which is the whole point: that job should
-- not come back to the coach every time.
--
-- Everything here is locked down: RLS on, no anon or authenticated policies.
-- The pages read it with the service client, behind the parent cookie.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── parents: who has come through the door ──────────────────────────────────
create table if not exists public.parents (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  email          text        not null unique,   -- unique → signing up twice updates
  phone          text,
  player_name    text,
  token          text        not null unique,   -- their own way back in
  is_team_parent boolean     not null default false,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);

create index if not exists parents_team_parent_idx on public.parents (is_team_parent) where is_team_parent;

-- ── signup_sheets: one per thing that needs volunteers ──────────────────────
create table if not exists public.signup_sheets (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  event_date   timestamptz,
  location     text,
  is_open      boolean     not null default true,
  created_by   text,                              -- a name, for the page to show
  created_at   timestamptz not null default now()
);

create index if not exists signup_sheets_open_idx on public.signup_sheets (is_open, event_date);

-- ── signup_slots: the rows on the sheet ─────────────────────────────────────
create table if not exists public.signup_slots (
  id         uuid primary key default gen_random_uuid(),
  sheet_id   uuid not null references public.signup_sheets (id) on delete cascade,
  label      text not null,
  detail     text,
  needed     int  not null default 1,
  sort_order int  not null default 0
);

create index if not exists signup_slots_sheet_idx on public.signup_slots (sheet_id, sort_order);

-- ── signup_claims: who took what ────────────────────────────────────────────
-- The name is copied onto the claim rather than only pointed at, so a sheet
-- still reads correctly after a parent row is removed.
create table if not exists public.signup_claims (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references public.signup_slots (id) on delete cascade,
  parent_id  uuid references public.parents (id) on delete set null,
  name       text not null,
  email      text,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists signup_claims_slot_idx on public.signup_claims (slot_id);

alter table public.parents       enable row level security;
alter table public.signup_sheets enable row level security;
alter table public.signup_slots  enable row level security;
alter table public.signup_claims enable row level security;

-- ── A first sheet, so the hub is not empty the day it goes out ──────────────
-- Only if it isn't already there: re-running this must not make a second copy,
-- and must not undo edits a coach has made to the slots.
do $$
declare sheet uuid;
begin
  if not exists (select 1 from public.signup_sheets where title = 'Barton College Playday — what we need') then
    insert into public.signup_sheets (title, description, event_date, location, created_by)
    values (
      'Barton College Playday — what we need',
      'Saturday, December 5 at Barton College in Wilson. Players get themselves there 45 minutes before the first game. Here is what would help on the sideline.',
      '2026-12-05 08:00:00-05',
      'Barton College, Wilson NC',
      'Coach Nolan'
    )
    returning id into sheet;

    insert into public.signup_slots (sheet_id, label, needed, detail, sort_order) values
      (sheet, 'Water & Gatorade cooler', 2, 'Enough for the whole roster, plus cups', 0),
      (sheet, 'Snacks between games',    2, 'Oranges, bagels, anything easy',        1),
      (sheet, 'Pop-up tent and chairs',  1, 'December on a sideline is long',        2),
      (sheet, 'Photos / film',           2, 'Sideline video and pictures for the team', 3);
  end if;
end $$;
