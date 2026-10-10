-- ════════════════════════════════════════════════════════════════════════════
-- Coaching Bank
--
-- The head coach's philosophy, filed by area of coaching (Running Drills,
-- Culture & Standards, …), for the staff to go through. Each entry is the
-- point in his words, an optional clip (Instagram, YouTube, …) and notes.
-- Areas are plain text: the defaults live in src/lib/coachingBank.ts and he
-- can start new ones. Read and written through the server's own key only.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.coaching_entries (
  id          uuid primary key default gen_random_uuid(),
  area        text not null,
  title       text not null,
  url         text,
  point       text,
  notes       text,
  position    double precision not null default 0,
  added_by    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists coaching_entries_area_idx on public.coaching_entries (area, position);

alter table public.coaching_entries enable row level security;
