-- ════════════════════════════════════════════════════════════════════════════
-- Film Room edits
--
-- The head coach's edit of a team film: the stretches cut out of it, as
-- [[start, end], …] in seconds of the original. Non-destructive — the film on
-- Cloudflare is untouched and the board skips the cuts when anyone plays it
-- (src/components/videoboard/cuts.ts). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_videos add column if not exists cuts jsonb not null default '[]'::jsonb;
