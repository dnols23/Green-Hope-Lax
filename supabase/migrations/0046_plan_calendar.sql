-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — practice plans and the calendar
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
--   on_calendar        — whether the plan shows on the calendar by itself.
--                        Every plan already made stays on it; new ones start off.
--   calendar_event_id  — the practice on the calendar this plan was made from.
--                        That practice carries the plan, so it isn't drawn twice.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans add column if not exists on_calendar boolean not null default true;
alter table public.plans add column if not exists calendar_event_id uuid
  references public.calendar_events (id) on delete set null;

create index if not exists plans_calendar_event_idx on public.plans (calendar_event_id);
