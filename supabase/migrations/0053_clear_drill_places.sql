-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — clear "Where it can be done" on every drill
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The places (wall, on your own, with a friend, at practice, watch it) were
-- filled in for the coaches, and wrongly. This wipes them once so the staff
-- can tick them drill by drill.
--
-- Safe to re-run: it clears only the first time, and leaves alone anything
-- ticked after that.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from public.app_settings where key = 'drill_places_cleared') then
    update public.drills set settings = '{}', setting = 'team';
    insert into public.app_settings (key, value) values ('drill_places_cleared', now()::text);
  end if;
end $$;
