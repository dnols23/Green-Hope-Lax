-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — notes made of blocks
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A note was one box of text. It is now a page you build: sections, checklists,
-- charts, and a lacrosse field with a play drawn on it — the last of which is
-- the point, because a play drawn into a note is on the sideline in March and a
-- paragraph describing that play is not.
--
-- Its own column rather than sharing `blocks` with practice plans: those are
-- timed blocks with tags and a running clock, and reading one as the other
-- would quietly throw half of each away.
--
-- Safe to re-run. Notes written before this keep their text — the first block
-- of the new page is the old note.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists content jsonb not null default '[]'::jsonb;

-- Carry an old single-box note into the new shape, once, for notes that have
-- text and no blocks yet.
update public.plans
set content = jsonb_build_array(
      jsonb_build_object(
        'id', 'n_carried',
        'kind', 'text',
        'text', summary
      )
    )
where kind = 'note'
  and coalesce(summary, '') <> ''
  and content = '[]'::jsonb;
