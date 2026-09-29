-- =====================================================================
-- 007 · Assignments & submissions (incl. peer review + rubric)
-- =====================================================================

create table if not exists public.assignments (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses(id) on delete cascade,
  lesson_id            uuid references public.lessons(id) on delete cascade,
  instructor_id        uuid not null references public.users(id) on delete cascade,
  title                text not null,
  instructions         text,                       -- rich text
  due_date             timestamptz,
  max_points           integer not null default 100,
  allow_late           boolean not null default true,
  late_penalty_percent integer not null default 0,
  peer_review          boolean not null default false,
  attachments          jsonb not null default '[]'::jsonb, -- downloadable resources
  rubric               jsonb not null default '[]'::jsonb, -- [{criterion,max_points,levels}]
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_assignments_course on public.assignments(course_id);
select public.touch_updated_at('public.assignments');

create table if not exists public.assignment_submissions (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null references public.assignments(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  text_submission  text,
  files            jsonb not null default '[]'::jsonb, -- [{name,url,path}] (Supabase Storage)
  status           text not null default 'pending'
     check (status in ('pending','submitted','graded','late','resubmission_requested')),
  score            integer,
  feedback         text,
  rubric_scores    jsonb not null default '{}'::jsonb,
  peer_reviews     jsonb not null default '[]'::jsonb,
  submitted_at     timestamptz,
  graded_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (assignment_id, user_id)
);
create index if not exists idx_sub_user on public.assignment_submissions(user_id);
select public.touch_updated_at('public.assignment_submissions');
