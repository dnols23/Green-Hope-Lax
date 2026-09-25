-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Team Hub and Parent Hub accounts
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Players and parents get in with a code, then make an account (email and
-- password) so they can sign back in on any phone. Players answer a favorites
-- and season-goals questionnaire and, last, acknowledge the athletics code of
-- conduct; parents give their contact details and a few quick answers.
--
-- Server-only, like the rest of the hubs: RLS on, no policies. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.hub_accounts (
  id               uuid primary key default gen_random_uuid(),
  kind             text        not null check (kind in ('player', 'parent')),
  email            text        not null,
  password_hash    text        not null,
  name             text        not null,
  phone            text,
  player_id        uuid,                                  -- a player's own roster entry
  player_ids       jsonb       not null default '[]'::jsonb, -- a parent's players
  parent_id        uuid,                                  -- a parent's Parent Hub row
  contacts         jsonb       not null default '{}'::jsonb,
  answers          jsonb       not null default '{}'::jsonb,
  conduct_signed_name text,
  conduct_agreed_at   timestamptz,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz,
  unique (kind, email)
);

create unique index if not exists hub_accounts_player_idx
  on public.hub_accounts (player_id) where kind = 'player';

alter table public.hub_accounts enable row level security;
