-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — the wish list
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- What the program needs and what it wants: who to ask and how to ask for it,
-- and the head coach's call on each (approved / rejected) with next steps.
-- Coach-only; the website server reads and writes it. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.wish_items (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  kind          text        not null default 'want' check (kind in ('need', 'want')),
  team          text        not null default 'program' check (team in ('program', 'varsity', 'jv')),
  cost          text,
  link          text,
  contact       text,
  pitch         text,
  status        text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  next_steps    text,
  decided_at    timestamptz,
  added_by      text,
  added_by_name text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists wish_items_kind_idx on public.wish_items (kind, status);

alter table public.wish_items enable row level security;
