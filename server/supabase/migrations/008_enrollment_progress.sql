-- =====================================================================
-- 008 · Enrollment, progress tracking, learning stats & certificates
-- =====================================================================

create table if not exists public.enrollments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  course_id           uuid not null references public.courses(id) on delete cascade,
  order_id            uuid,                          -- FK added after orders table (012)
  source              text not null default 'purchase'
        check (source in ('purchase','free','gift','bulk','subscription','coupon')),
  status              text not null default 'active'
        check (status in ('active','completed','revoked','expired')),
  progress_percent    integer not null default 0,
  access_expires_at   timestamptz,
  last_accessed_at    timestamptz,
  last_lesson_id      uuid references public.lessons(id) on delete set null,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists idx_enroll_user   on public.enrollments(user_id);
create index if not exists idx_enroll_course on public.enrollments(course_id);
select public.touch_updated_at('public.enrollments');

create table if not exists public.lesson_progress (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete cascade,
  lesson_id        uuid not null references public.lessons(id) on delete cascade,
  completed        boolean not null default false,
  position_seconds integer not null default 0,   -- resume position within video
  watched_seconds  integer not null default 0,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index if not exists idx_lp_user_course on public.lesson_progress(user_id, course_id);
select public.touch_updated_at('public.lesson_progress');

-- Realtime notes per lesson (student's own notes)
create table if not exists public.lesson_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  note        text not null,
  timestamp_s integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.touch_updated_at('public.lesson_notes');

create table if not exists public.learning_stats (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,
  total_seconds     bigint not null default 0,
  streak_days       integer not null default 0,
  last_active_date  date,
  courses_completed integer not null default 0,
  updated_at        timestamptz not null default now()
);

create table if not exists public.recently_viewed (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists idx_recent_user on public.recently_viewed(user_id, viewed_at desc);

-- Learning goal (target completion date per enrolled course)
create table if not exists public.learning_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  target_date  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, course_id)
);
select public.touch_updated_at('public.learning_goals');

-- ---------------------------------------------------------------------
-- 009 · Certificates
-- ---------------------------------------------------------------------
create table if not exists public.certificates (
  id               uuid primary key default gen_random_uuid(),
  certificate_id   uuid not null unique default gen_random_uuid(), -- public verification id
  user_id          uuid not null references public.users(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete cascade,
  student_name     text not null,
  course_title     text not null,
  instructor_name  text,
  issued_at        text,                       -- human-readable date on the PDF
  pdf_url          text,                       -- Supabase Storage public URL
  pdf_path         text,                       -- bucket-relative path for signed downloads
  verify_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists idx_cert_verify on public.certificates(certificate_id);
select public.touch_updated_at('public.certificates');
