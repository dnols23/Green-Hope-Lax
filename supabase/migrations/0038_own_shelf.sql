-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — every coach's own shelf
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The Library was one pile. Everything anybody drew or screenshotted landed in
-- it, so a coach looking for the thing he saved on Tuesday scrolled past
-- everyone else's, and two coaches saving "1-4-1 pop" wrote over each other.
--
-- A shelf per coach instead, keyed on their login rather than their display
-- name, so renaming somebody in Coach Access doesn't orphan their work. The
-- head coach sees every shelf — he is the one who has to know whether the staff
-- is actually producing anything.
--
-- Rows written before this have no owner and stay on the shelf everybody sees,
-- which is where they have always been.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plays          add column if not exists owner_email text;
alter table public.library_items  add column if not exists owner_email text;

create index if not exists plays_owner_idx         on public.plays (owner_email, updated_at desc);
create index if not exists library_items_owner_idx on public.library_items (owner_email, created_at desc);

-- One play per name *per coach*. Two coaches are allowed their own 1-4-1 pop.
drop index if exists public.plays_name_idx;
create index if not exists plays_owner_name_idx on public.plays (owner_email, name);
