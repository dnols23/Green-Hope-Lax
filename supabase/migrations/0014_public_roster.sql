-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — publish a roster to the public site
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Which players the public /roster page shows was decided one player at a time,
-- with an is_active flag. Coaches think in squads, not rows: mark "2025-2026
-- Season" as the published roster and that is the public list.
--
-- Nothing changes until a roster is actually published. With none marked, the
-- public page keeps using is_active exactly as before.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.player_lists
  add column if not exists is_public boolean not null default false;

create index if not exists player_lists_public_idx on public.player_lists (is_public);
