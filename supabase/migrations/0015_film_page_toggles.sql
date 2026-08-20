-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — switch the Film Room on or off per audience
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The Film Room is in two places: inside the admin for coaches, and in the Team
-- Hub for parents and players. They're separate audiences, so they get separate
-- switches on Admin → Pages rather than one that governs both.
--
-- Both default to on, so nothing changes until you turn one off.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.page_settings (key, label, href, sort_order) values
  ('film-coaches', 'Film Room — Coaches',  '/admin/film', 20),
  ('film-team',    'Film Room — Team Hub', '/team/video', 21)
on conflict (key) do update
  set label = excluded.label, href = excluded.href, sort_order = excluded.sort_order;
