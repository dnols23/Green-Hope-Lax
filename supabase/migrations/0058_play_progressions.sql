-- ════════════════════════════════════════════════════════════════════════════
-- Play progressions
--
-- A play on the Playboard can be a run of steps, like slides: the set, the
-- pick, the slip, the shot. steps is [{ "board": {…}, "note": text }, …];
-- board keeps step 1, so everything that shows a play still has a picture.
-- Null (or a single step) is an ordinary play.
--
-- "Add to playbook" puts a progression in as a run of pages, one per step.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plays add column if not exists steps jsonb;
