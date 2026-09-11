-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — the photo store
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- A coach has a photo on their phone, not a web address. This is the bucket
-- those photos land in: public to read (they end up on the public site), and
-- written only by the server, so nobody can upload to it from outside the
-- admin.
--
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  6291456,                                       -- 6 MB, well past a resized phone photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read a photo in this bucket — they are the pictures on the site.
-- Uploads go through the service role, which bypasses these policies, so there
-- is deliberately no insert or update policy here.
drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');
