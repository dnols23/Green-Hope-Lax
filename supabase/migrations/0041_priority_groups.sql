-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — priorities by position and group, in the staff's order
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Two things:
--
--   1. Every item on a list gets a place (sort_order), so the head coach can
--      slide them into the order that matters rather than living with worst-
--      first. Items already on a list keep the order they show in today —
--      worst first, oldest first — as their starting place.
--
--   2. A list for every position and for the groups the staff keeps — for
--      varsity and for JV. Lists that already exist under the same name
--      ("Man-up" and "Man up" count as the same) are left alone, so nothing
--      is doubled up and nothing already written moves.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.priority_items
  add column if not exists sort_order double precision;

-- Today's order, as each list's starting order.
with ranked as (
  select id,
         row_number() over (partition by list_id order by level desc, created_at asc) as n
  from public.priority_items
  where sort_order is null
)
update public.priority_items p
set sort_order = ranked.n
from ranked
where p.id = ranked.id;

create index if not exists priority_items_order_idx
  on public.priority_items (list_id, sort_order);

-- The positions, then the groups, after whatever each team already has.
insert into public.priority_lists (name, sort_order, team)
select l.name,
       coalesce((select max(sort_order) from public.priority_lists where team = t.team), 0) + l.n,
       t.team
from (values ('varsity'), ('jv')) as t(team)
cross join (values
  ('Attack', 1), ('Midfield', 2), ('Faceoff', 3), ('Defense', 4), ('LSM', 5), ('SSDM', 6), ('Goalie', 7),
  ('Leadership', 8), ('Man up', 9), ('Man down', 10), ('Clearing', 11), ('Riding', 12),
  ('Culture', 13), ('Fundraising', 14)
) as l(name, n)
where not exists (
  select 1 from public.priority_lists x
  where x.team = t.team
    and regexp_replace(lower(x.name), '[^a-z]', '', 'g') = regexp_replace(lower(l.name), '[^a-z]', '', 'g')
);
