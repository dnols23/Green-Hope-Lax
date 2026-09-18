-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — priority lists
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- What you notice on the sideline, written down where you will find it again.
-- A list per phase of the game — Offense, Defense, Man-up, Man-down — and on
-- each list the things that need work, ranked. Practice planning then starts
-- from the list instead of from memory.
--
-- Coach-only: RLS on with no anon or authenticated policies, like plays.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.priority_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  sort_order int         not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

-- One list per name: two coaches both starting a "Defense" list would split the
-- program's attention across two places, which is the thing this is meant to fix.
create unique index if not exists priority_lists_name_idx
  on public.priority_lists (lower(name));

create table if not exists public.priority_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid        not null references public.priority_lists (id) on delete cascade,
  body       text        not null,
  -- 1 later · 2 soon · 3 high · 4 now
  level      int         not null default 2,
  done       boolean     not null default false,
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists priority_items_list_idx
  on public.priority_items (list_id, done, level desc);

alter table public.priority_lists enable row level security;
alter table public.priority_items enable row level security;

-- The lists a lacrosse staff actually keeps. Renaming or deleting one later is
-- fine; this only fills an empty shelf.
insert into public.priority_lists (name, sort_order) values
  ('Offense',  1),
  ('Defense',  2),
  ('Man-up',   3),
  ('Man-down', 4),
  ('Ride and clear', 5)
on conflict do nothing;
