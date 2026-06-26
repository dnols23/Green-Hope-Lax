-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — visibility flags for Coaches & Awards
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Adds a published/hidden flag so coaches and awards can be toggled live or
-- hidden with one click from the admin panel (matching news, stats, roster, and
-- team posts, which already have one). Existing rows default to published.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.coaches     add column if not exists is_published boolean not null default true;
alter table public.team_awards add column if not exists is_published boolean not null default true;

-- ── Coaches: public sees only published; admins (authenticated) see all ────────
drop policy if exists "public read coaches" on public.coaches;
create policy "public read coaches" on public.coaches
  for select to anon using (is_published = true);

drop policy if exists "admin read coaches" on public.coaches;
create policy "admin read coaches" on public.coaches
  for select to authenticated using (true);

-- ── Awards: public sees only published; admins (authenticated) see all ─────────
drop policy if exists "public read awards" on public.team_awards;
create policy "public read awards" on public.team_awards
  for select to anon using (is_published = true);

drop policy if exists "admin read awards" on public.team_awards;
create policy "admin read awards" on public.team_awards
  for select to authenticated using (true);
