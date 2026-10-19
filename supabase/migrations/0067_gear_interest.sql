-- ════════════════════════════════════════════════════════════════════════════
-- Bag & glove head count
--
-- The Green Hope Maverik M6 gloves and Monster bag only get made if at least
-- six of each are ordered. Families say they want one here (/shop/headcount);
-- the page shows how close each item is, the head coach sees who. Not an
-- order and not a payment. One row per player per item per email — saying it
-- again changes the size or quantity instead of counting twice. Server only.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.gear_interest (
  id            uuid primary key default gen_random_uuid(),
  item          text not null,
  player_name   text not null,
  contact_name  text,
  email         text not null,
  size          text,
  qty           integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint gear_interest_item_check check (item in ('gloves', 'bag')),
  constraint gear_interest_qty_check check (qty between 1 and 10),
  unique (item, email, player_name)
);

alter table public.gear_interest enable row level security;
