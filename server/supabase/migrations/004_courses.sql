-- =====================================================================
-- 004 · Courses
-- =====================================================================

create table if not exists public.courses (
  id                    uuid primary key default gen_random_uuid(),
  instructor_id         uuid not null references public.users(id) on delete cascade,
  title                 text not null,
  subtitle              text,
  description           text,                       -- rich text (Tiptap HTML)
  slug                  text not null unique,

  category_id           uuid references public.categories(id) on delete set null,
  subcategory_id        uuid references public.categories(id) on delete set null,
  tags                  text[] not null default '{}',
  level                 text not null default 'All Levels'
          check (level in ('Beginner','Intermediate','Advanced','All Levels')),
  language              text not null default 'English',
  caption_language      text,

  -- pricing
  price                 numeric(10,2) not null default 0,
  currency              text not null default 'usd',
  is_free               boolean not null default false,

  -- editorial
  learning_objectives   text[] not null default '{}',
  requirements          text[] not null default '{}',
  target_audience       text,

  -- media (Supabase Storage)
  thumbnail_url         text,
  thumbnail_path        text,
  intro_video_url       text,
  intro_video_path      text,

  -- SEO
  seo_title             text,
  seo_description       text,

  -- access & certification
  access_type           text not null default 'lifetime' check (access_type in ('lifetime','expiring')),
  access_expires_days   integer,
  certificate_template  jsonb not null default '{}'::jsonb,

  -- workflow: draft -> submitted -> approved/rejected -> published/unpublished
  status                text not null default 'draft'
          check (status in ('draft','submitted','approved','rejected','published','unpublished')),
  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid references public.users(id),
  rejection_reason      text,
  published_at          timestamptz,
  version               integer not null default 1,   -- content versioning

  -- promotion / merchandising
  is_featured           boolean not null default false,
  is_sponsored          boolean not null default false,

  -- denormalised aggregates
  enrollment_count      integer not null default 0,
  rating_avg            numeric(3,2) not null default 0,
  rating_count          integer not null default 0,
  review_count          integer not null default 0,
  total_lessons         integer not null default 0,
  total_duration_seconds integer not null default 0,

  search_vector         tsvector,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_courses_instructor on public.courses(instructor_id);
create index if not exists idx_courses_category   on public.courses(category_id);
create index if not exists idx_courses_status     on public.courses(status);
create index if not exists idx_courses_featured   on public.courses(is_featured) where is_featured = true;
create index if not exists idx_courses_search     on public.courses using gin(search_vector);
create index if not exists idx_courses_tags       on public.courses using gin(tags);
create index if not exists idx_courses_price      on public.courses(price);
select public.touch_updated_at('public.courses');

-- keep the search vector in sync -------------------------------------
create or replace function public.courses_search_trigger() returns trigger language plpgsql as $$
begin
  new.search_vector := public.course_search_vector(new);
  return new;
end; $$;
drop trigger if exists trg_courses_search on public.courses;
create trigger trg_courses_search before insert or update of title, subtitle, description, tags
  on public.courses for each row execute function public.courses_search_trigger();
