-- =====================================================================
-- 020 · Row Level Security
--
-- The Node API uses the Supabase SERVICE-ROLE key which BYPASSES RLS, so
-- these policies govern *direct* client access (Supabase JS / Realtime).
--
-- Authentication is owned by Clerk. To let the browser subscribe to Realtime
-- and read its own rows, the frontend exchanges the Clerk session for a
-- Supabase access token whose `sub` is the Clerk user id (see README →
-- "Clerk → Supabase JWT"). `auth_user_id()` maps that claim back to users.id.
-- =====================================================================

-- Resolve the calling user's app UUID from the JWT (Clerk sub or Supabase uid).
create or replace function public.auth_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select u.id
    from public.users u
   where u.clerk_id = (coalesce(auth.jwt() ->> 'sub', ''))
      or u.id::text = (coalesce(auth.jwt() ->> 'sub', ''))
   limit 1;
$$;

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.users where id = public.auth_user_id()), 'anon');
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.auth_role() in ('admin','super_admin','moderator');
$$;

-- ---------------------------------------------------------------------
-- Turn RLS on for every public table (idempotent).
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
         and tablename not in ('spatial_ref_sys') loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Helper: a fully permissive policy for the service role on every table,
-- so behaviour is identical whether or not the key has BYPASSRLS.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "service_role_all" on public.%I', t.tablename);
    execute format('create policy "service_role_all" on public.%I for all to service_role using (true) with check (true)', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- PUBLIC READ (anon + authenticated) — catalogue & marketing content
-- ---------------------------------------------------------------------
drop policy if exists public_read_categories on public.categories;
create policy public_read_categories on public.categories for select to anon, authenticated using (is_active = true);

drop policy if exists public_read_courses on public.courses;
create policy public_read_courses on public.courses for select to anon, authenticated using (status = 'published');

drop policy if exists public_read_sections_lessons on public.sections;
create policy public_read_sections_lessons on public.sections for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));

drop policy if exists public_read_preview_lessons on public.lessons;
create policy public_read_preview_lessons on public.lessons for select to anon, authenticated
  using (
    is_preview = true
    or public.is_staff()
    or exists (select 1 from public.courses c
                where c.id = course_id and c.instructor_id = public.auth_user_id())
  );

drop policy if exists public_read_reviews on public.reviews;
create policy public_read_reviews on public.reviews for select to anon, authenticated using (is_hidden = false);

drop policy if exists public_read_certificates on public.certificates;
create policy public_read_certificates on public.certificates for select to anon, authenticated using (true); -- verification is public by id

drop policy if exists public_read_blog on public.blog_posts;
create policy public_read_blog on public.blog_posts for select to anon, authenticated using (is_published = true);

drop policy if exists public_read_pages_faqs on public.cms_pages;
create policy public_read_pages_faqs on public.cms_pages for select to anon, authenticated using (true);
drop policy if exists public_read_faqs on public.faqs;
create policy public_read_faqs on public.faqs for select to anon, authenticated using (true);

drop policy if exists public_read_plans on public.subscription_plans;
create policy public_read_plans on public.subscription_plans for select to anon, authenticated using (is_active = true);

drop policy if exists public_read_announcements on public.platform_announcements;
create policy public_read_announcements on public.platform_announcements for select to anon, authenticated using (active = true);

drop policy if exists public_read_profiles on public.users;
create policy public_read_profiles on public.users for select to anon, authenticated
  using (id = public.auth_user_id() or role in ('instructor','admin','super_admin','moderator'));

drop policy if exists public_read_live_classes on public.live_classes;
create policy public_read_live_classes on public.live_classes for select to anon, authenticated
  using (is_public = true or instructor_id = public.auth_user_id() or public.is_staff());

drop policy if exists public_read_coursesettings on public.platform_settings;
create policy public_read_coursesettings on public.platform_settings for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- SELF ACCESS — a signed-in user manages their own rows
-- ---------------------------------------------------------------------
drop policy if exists self_notifications on public.notifications;
create policy self_notifications on public.notifications for all to authenticated
  using (user_id = public.auth_user_id()) with check (user_id = public.auth_user_id());

drop policy if exists self_enrollments on public.enrollments;
create policy self_enrollments on public.enrollments for select to authenticated
  using (user_id = public.auth_user_id() or public.is_staff());

drop policy if exists self_progress on public.lesson_progress;
create policy self_progress on public.lesson_progress for all to authenticated
  using (user_id = public.auth_user_id()) with check (user_id = public.auth_user_id());

drop policy if exists self_wishlist on public.wishlist;
create policy self_wishlist on public.wishlist for all to authenticated
  using (user_id = public.auth_user_id()) with check (user_id = public.auth_user_id());

-- Everything else (courses write, orders, payouts, admin tables, …) is
-- reachable ONLY through the service-role API; anon/authenticated have no
-- insert/update/delete policy on those tables and are therefore denied.
