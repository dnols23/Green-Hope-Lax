-- ════════════════════════════════════════════════════════════════════════════
-- Content Studio: video templates rendered on GitHub Actions.
--
-- A content item can carry one template video: which template, the answers,
-- the sound bed, and the latest render. Rendering runs in
-- .github/workflows/render-video.yml, which uploads to one-time signed URLs in
-- the content-video bucket:
--   {item}/photo-{ts}.jpg          photos added in the editor
--   {item}/render-{ts}.mp4         the finished video
--   {item}/render-{ts}.error.txt   what went wrong, if it failed
-- The app notices either file and settles video_status.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.content_items
  add column if not exists video_template     text,
  add column if not exists video_fields       jsonb not null default '{}'::jsonb,
  add column if not exists video_track        text,
  add column if not exists video_status       text,
  add column if not exists video_job          text,   -- {item}/render-{ts}, without the extension
  add column if not exists video_path         text,   -- the finished mp4 in content-video
  add column if not exists video_error        text,
  add column if not exists video_requested_at timestamptz;

do $$ begin
  alter table public.content_items
    add constraint content_items_video_status_check
    check (video_status is null or video_status in ('rendering', 'ready', 'failed'));
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public)
values ('content-video', 'content-video', false)
on conflict (id) do nothing;

do $$ begin
  create policy "admin content-video" on storage.objects
    for all to authenticated
    using (bucket_id = 'content-video') with check (bucket_id = 'content-video');
exception when duplicate_object then null; end $$;
