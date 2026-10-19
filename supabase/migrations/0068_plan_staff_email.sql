-- ════════════════════════════════════════════════════════════════════════════
-- Practice plans: when the staff were emailed about one
--
-- A practice emails the coaching staff once — the first time it's saved with
-- a date and its drills (src/lib/staffNotify.ts). This is when that happened,
-- so later edits don't email again. Plans that existed before count as sent.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans add column if not exists coaches_emailed_at timestamptz;
update public.plans set coaches_emailed_at = now() where coaches_emailed_at is null;
