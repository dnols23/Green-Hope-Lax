-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — varsity and JV plans
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A practice plan belongs to a team. The two staffs plan their own weeks, and a
-- JV coach opening the planner should see the JV plans — not a list of both to
-- pick his way through.
--
-- Everything already written is varsity, which is what it was: the JV side
-- starts empty and fills up from here.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists team text not null default 'varsity';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_team_check') then
    alter table public.plans
      add constraint plans_team_check check (team in ('varsity', 'jv'));
  end if;
end $$;

-- The planner asks for one team's plans, newest first.
create index if not exists plans_team_date_idx
  on public.plans (team, kind, plan_date desc nulls last);
