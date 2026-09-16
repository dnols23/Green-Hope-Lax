-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — signing equipment out to players
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The inventory said how many helmets the program owns. It could not say who
-- has them, which is the only question anybody asks in June.
--
-- A sign-out is its own row rather than a number knocked off the item: the
-- count of what the program owns doesn't change when a kid takes one home, and
-- an item is "3 of 12 out" until they come back. The player's name and the item
-- name are copied onto the row so last season's record still reads after a
-- player graduates or an item is retired.
--
-- Coach-only: RLS on with no anon or authenticated policies.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.equipment_assignments (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references public.team_inventory (id) on delete set null,
  item_name     text        not null,
  size          text,
  player_id     uuid references public.players (id) on delete set null,
  player_name   text        not null,
  quantity      int         not null default 1 check (quantity > 0),
  out_at        timestamptz not null default now(),
  due_at        timestamptz,
  returned_at   timestamptz,
  condition_out text,
  notes         text,
  signed_by     text,
  created_at    timestamptz not null default now()
);

-- The two questions: what has this player got, and who has this item.
create index if not exists equipment_player_idx on public.equipment_assignments (player_id, returned_at);
create index if not exists equipment_item_idx   on public.equipment_assignments (item_id, returned_at);

alter table public.equipment_assignments enable row level security;
