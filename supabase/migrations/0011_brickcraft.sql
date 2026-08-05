-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — register the BrickCraft arcade page
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- BrickCraft is a browser game with no data behind it — scores live in the
-- player's own browser, so there are no tables here. This only adds the page to
-- the list in /admin → Pages so it can be hidden or shown like any other page.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.page_settings (key, label, href, sort_order) values
  ('brickcraft', 'BrickCraft', '/brickcraft', 13)
on conflict (key) do update
  set label = excluded.label, href = excluded.href, sort_order = excluded.sort_order;
