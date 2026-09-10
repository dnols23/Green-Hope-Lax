-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Planner (practice plans, game plans, coaching notes)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- One table. A plan is a title, a date, and an ordered list of blocks; a block
-- is a stretch of time with notes and, optionally, a field diagram. Blocks and
-- diagrams are jsonb because their shape is the coach's, not the database's —
-- a face-off drill and a man-up install have nothing in common structurally.
--
-- Coach-only, like the rest of the Coaches Hub: RLS on with no anon or
-- authenticated policies, so only the server (service role) touches it.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'practice',
  title       text not null,
  plan_date   date,
  season      text,
  summary     text,
  -- [{ id, title, minutes, tag, notes, board }]
  blocks      jsonb not null default '[]'::jsonb,
  -- The roster this plan is being run with, if any.
  roster_id   uuid references public.player_lists(id) on delete set null,
  is_template boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_kind_check') then
    alter table public.plans
      add constraint plans_kind_check check (kind in ('practice', 'game', 'note'));
  end if;
end $$;

create index if not exists plans_kind_date_idx on public.plans (kind, plan_date desc nulls last);
create index if not exists plans_roster_idx    on public.plans (roster_id);

alter table public.plans enable row level security;
