-- =====================================================================
-- 021 · Storage buckets
--
-- All media lives in Supabase Storage — nothing is written to disk by
-- the API. Run this AFTER the schema migrations.
--
-- Either execute this file in the Dashboard SQL Editor, or create the
-- buckets manually in Storage → New bucket with the same names/access.
--
--   videos  — lesson video/audio/PDF source files   (PRIVATE, signed URLs)
--   files   — student assignment submissions, docs  (PRIVATE)
--   media   — course assets: thumbnails, previews    (PUBLIC)
--   avatars — user profile pictures                  (PUBLIC)
--   certs   — generated certificate / invoice PDFs   (PRIVATE)
--   docs    — CMS / blog attachments                 (PUBLIC)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos',  'videos',  false, 2147483648, array['video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav','application/pdf']),
  ('files',   'files',   false, 104857600,  null),
  ('media',   'media',   true,  5242880,    array['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true,  2097152,    array['image/jpeg','image/png','image/webp']),
  ('certs',   'certs',   false, 10485760,   array['application/pdf']),
  ('docs',    'docs',    true,  104857600,  null)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Storage policies
--
-- The service-role API performs every upload/delete through the admin
-- SDK, which bypasses RLS, so these policies only govern *direct*
-- browser access (public reads + Clerk-JWT based ownership).
-- ---------------------------------------------------------------------

-- Public buckets: anyone may read.
drop policy if exists "media is public" on storage.objects;
create policy "media is public" on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('media','avatars','docs'));

-- Private buckets: only the owner may read their own objects.
-- Object paths are written by the API as `{folder}/{userId}/...`,
-- so the first two path tokens identify the owner.
drop policy if exists "private buckets owner read" on storage.objects;
create policy "private buckets owner read" on storage.objects for select
  to authenticated
  using (
    bucket_id in ('videos','files','certs')
    and (
      public.is_staff()
      or owner = (select uid from auth.users where id = auth.uid())
      or (storage.foldername(name))[2] = coalesce(auth.jwt() ->> 'sub', '')
    )
  );

-- No insert/update/delete policy is granted to anon/authenticated:
-- every write goes through the Node API (service role).
