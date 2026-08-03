-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — real columns for the form collections
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Every player form landed in interest_form_submissions, and which form it was
-- could only be guessed by reading a "[…]" tag off the front of the notes. Any
-- row submitted before that tagging existed has no tag at all, so it silently
-- files as high school interest, and a row that lands in the wrong bucket can't
-- be moved without editing its notes text.
--
-- Fall league gets its own table; the interest form gets a real form_type
-- column. Both are backfilled from the old tags, which are then stripped.
--
-- Safe to re-run: every step is keyed off the "[…]" prefixes, which no longer
-- exist after the first run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── swfl_signups: SWFL fall league, its own collection ───────────────────────
create table if not exists public.swfl_signups (
  id            uuid primary key default gen_random_uuid(),
  player_first  text             not null,
  player_last   text             not null,
  grad_year     text,
  parent_name   text             not null,
  parent_email  text             not null,
  parent_phone  text             not null,
  player_email  text,
  experience    experience_level not null default 'new',
  notes         text,
  created_at    timestamptz      not null default now()
);

create index if not exists swfl_created_idx on public.swfl_signups (created_at desc);

-- Same posture as the other form tables: anyone may submit, nobody anonymous
-- may read them back (no anon select policy), admins get everything.
alter table public.swfl_signups enable row level security;

drop policy if exists "public insert swfl" on public.swfl_signups;
create policy "public insert swfl" on public.swfl_signups
  for insert to anon, authenticated with check (true);

drop policy if exists "admin all swfl_signups" on public.swfl_signups;
create policy "admin all swfl_signups" on public.swfl_signups
  for all to authenticated using (true) with check (true);

-- ── interest_form_submissions: which team the form was for ───────────────────
alter table public.interest_form_submissions
  add column if not exists form_type text not null default 'high_school';

do $$ begin
  alter table public.interest_form_submissions
    add constraint interest_form_type_check
    check (form_type in ('high_school', 'green_machine'));
exception when duplicate_object then null; end $$;

-- ── Backfill from the old note tags ──────────────────────────────────────────
-- 1. Fall league signups move to their own table, notes untagged on the way.
insert into public.swfl_signups (
  player_first, player_last, grad_year, parent_name, parent_email,
  parent_phone, player_email, experience, notes, created_at
)
select
  player_first, player_last, grad_year, parent_name, parent_email,
  parent_phone, player_email, experience,
  nullif(btrim(regexp_replace(notes, '^\[SWFL Fall League\]\s*', '')), ''),
  created_at
from public.interest_form_submissions
where notes like '[SWFL Fall League]%';

delete from public.interest_form_submissions
where notes like '[SWFL Fall League]%';

-- 2. Green Machine vs high school becomes a column instead of a note prefix.
update public.interest_form_submissions
   set form_type = 'green_machine'
 where notes like '[Green Machine%';

-- 3. Drop the now-redundant "[…]" tag from the front of every remaining note.
update public.interest_form_submissions
   set notes = nullif(btrim(regexp_replace(notes, '^\[[^\]]*\]\s*', '')), '')
 where notes like '[%]%';
