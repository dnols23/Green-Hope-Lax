-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — repeating calendar events
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A repeating event is saved as one event per day it happens, all sharing a
-- series_id, so any one of them can be moved, changed or given its own
-- practice plan — and "this one and every later one" can be changed together.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.calendar_events add column if not exists series_id uuid;

create index if not exists calendar_events_series_idx on public.calendar_events (series_id, starts_at);
