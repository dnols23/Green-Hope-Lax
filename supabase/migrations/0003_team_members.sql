-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Team Hub registration / member contact list
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  parent_name     text not null,
  parent_email    text not null unique,   -- unique → re-registration updates, no dupes
  parent_phone    text not null,
  player_name     text not null,          -- can list multiple players
  player_grad_year text,
  player_team     text,                   -- optional: Boys Varsity / Boys JV / Unsure
  email_opt_in    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists team_members_optin_idx on public.team_members (email_opt_in);

-- Locked down: RLS on, no public policies. Only the service role (used by the
-- registration server action, behind the team password) can read/write it.
alter table public.team_members enable row level security;
