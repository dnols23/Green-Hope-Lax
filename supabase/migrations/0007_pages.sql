-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — page visibility
-- Run once in Supabase SQL Editor. Safe to re-run (re-seeds the page list).
--
-- One row per public page. Toggling is_published from /admin → Pages hides the
-- page from the nav and makes it 404 if visited directly. Non-sensitive (just
-- nav metadata + a flag), so the public may read it; only admins may change it.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.page_settings (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,          -- stable id, e.g. 'record-books'
  label        text not null,                 -- nav label
  href         text not null,                 -- route, e.g. '/record-books'
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.page_settings enable row level security;

drop policy if exists "public read pages" on public.page_settings;
create policy "public read pages" on public.page_settings
  for select to anon, authenticated using (true);

drop policy if exists "admin write pages" on public.page_settings;
create policy "admin write pages" on public.page_settings
  for all to authenticated using (true) with check (true);

-- Seed the page list (keeps is_published if a row already exists).
insert into public.page_settings (key, label, href, sort_order) values
  ('schedule',     'Schedule',     '/schedule',     1),
  ('stats',        'Stats',        '/stats',        2),
  ('record-books', 'Record Books', '/record-books', 3),
  ('roster',       'Roster',       '/roster',       4),
  ('coaches',      'Coaches',      '/coaches',      5),
  ('awards',       'Awards',       '/awards',       6),
  ('news',         'News',         '/news',         7),
  ('resources',    'Resources',    '/resources',    8),
  ('contact',      'Contact',      '/contact',      9),
  ('team',         'Team Hub',     '/team',         10)
on conflict (key) do update
  set label = excluded.label, href = excluded.href, sort_order = excluded.sort_order;
