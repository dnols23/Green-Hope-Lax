-- ════════════════════════════════════════════════════════════════════════════
-- Playbook sections
--
-- Each page of a team's playbook sits in a section — Offense, Defense,
-- Man-up, Man-down, Clears & rides, Faceoffs, Other (keys in
-- src/lib/playbook.ts, PLAYBOOK_SECTIONS). Null is "not sorted yet".
-- The deck is still one ordered list (sort_order); sections group it.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.playbook_pages add column if not exists section text;
