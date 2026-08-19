-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — three tiers of access
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Until now every signed-in Supabase user reached the whole admin panel, so a
-- coach could edit the store, the pages and the interest submissions. This adds
-- two columns to coach_accounts:
--
--   is_owner     the program owner. Sees everything, manages coaches.
--   permissions  which admin sections a coach may open, as a JSON array of
--                section keys (see src/lib/permissions.ts). Empty = Coaches Hub
--                and Film Room only, which every coach gets.
--
-- role ('head' / 'assistant') is untouched — it still drives who sees the
-- compiled evaluation board inside the Coaches Hub.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.coach_accounts
  add column if not exists is_owner    boolean not null default false;

alter table public.coach_accounts
  add column if not exists permissions jsonb   not null default '[]'::jsonb;

-- Whoever is already head coach becomes an owner, so the person running the
-- program cannot lock themselves out the moment this ships. Demote later from
-- Admin → Coach Access if that is not what you want.
update public.coach_accounts
   set is_owner = true
 where role = 'head'
   and is_owner = false;

create index if not exists coach_accounts_owner_idx on public.coach_accounts (is_owner);
