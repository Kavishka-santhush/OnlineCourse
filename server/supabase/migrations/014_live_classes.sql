-- =====================================================================
-- 014 · Live classes (virtual classroom) & attendance
-- =====================================================================

create table if not exists public.live_classes (
  id               uuid primary key default gen_random_uuid(),
  instructor_id    uuid not null references public.users(id) on delete cascade,
  course_id        uuid references public.courses(id) on delete cascade,
  lesson_id        uuid references public.lessons(id) on delete set null,
  title            text not null,
  description      text,
  starts_at        timestamptz not null,
  duration_minutes integer not null default 60,
  max_participants integer not null default 0,      -- 0 = unlimited
  is_public        boolean not null default false,  -- free preview vs enrolled-only
  status           text not null default 'scheduled'
     check (status in ('scheduled','live','ended','cancelled','recorded')),
  recording_url    text,
  recording_path   text,
  reminded_at      timestamptz,          -- set by the scheduler on the T-15 min reminder
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_live_starts on public.live_classes(starts_at);
create index if not exists idx_live_instr  on public.live_classes(instructor_id);
select public.touch_updated_at('public.live_classes');

create table if not exists public.live_class_attendance (
  id             uuid primary key default gen_random_uuid(),
  live_class_id  uuid not null references public.live_classes(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  unique (live_class_id, user_id)
);
