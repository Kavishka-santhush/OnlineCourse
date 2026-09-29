-- =====================================================================
-- 005 · Curriculum — sections & lessons
-- =====================================================================

create table if not exists public.sections (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  position    integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_sections_course on public.sections(course_id, position);
select public.touch_updated_at('public.sections');

create table if not exists public.lessons (
  id                      uuid primary key default gen_random_uuid(),
  course_id               uuid not null references public.courses(id) on delete cascade,
  section_id              uuid not null references public.sections(id) on delete cascade,
  title                   text not null,
  type                    text not null default 'video'
            check (type in ('video','article','pdf','audio','quiz','assignment','live_class')),
  content                 text,                     -- article body / instructions (rich text)
  position                integer not null default 1,
  duration_seconds        integer not null default 0,
  is_preview              boolean not null default false,   -- free preview for non-enrolled
  requires_completion     boolean not null default true,    -- counted toward progress
  prerequisite_lesson_id  uuid references public.lessons(id) on delete set null,

  -- media (Supabase Storage)
  video_url               text,
  video_path              text,
  captions                jsonb not null default '{}'::jsonb, -- {tracks:[{lang,url}]}
  attachment_urls         jsonb not null default '[]'::jsonb,
  resources               jsonb not null default '[]'::jsonb, -- [{name,url,path}]
  status                  text not null default 'draft' check (status in ('draft','published')),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists idx_lessons_section on public.lessons(section_id, position);
create index if not exists idx_lessons_course  on public.lessons(course_id);
select public.touch_updated_at('public.lessons');

-- Recompute course totals (lessons + duration) whenever lessons change
create or replace function public.recalc_course_totals() returns trigger language plpgsql as $$
declare
  c uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses
     set total_lessons = (select count(*) from public.lessons where course_id = c and status = 'published'),
         total_duration_seconds = (select coalesce(sum(duration_seconds),0) from public.lessons where course_id = c)
   where id = c;
  return new;
end; $$;
drop trigger if exists trg_lessons_totals on public.lessons;
create trigger trg_lessons_totals after insert or update or delete on public.lessons
  for each row execute function public.recalc_course_totals();
