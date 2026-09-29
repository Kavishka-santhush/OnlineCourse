-- =====================================================================
-- 016 · Engagement — Q&A, direct messages, course & platform announcements
-- =====================================================================

-- Self-referencing thread: a row with parent_id = null is a question,
-- a row with parent_id set is an answer.
create table if not exists public.qa_threads (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses(id) on delete cascade,
  lesson_id            uuid references public.lessons(id) on delete cascade,
  author_id            uuid not null references public.users(id) on delete cascade,
  parent_id            uuid references public.qa_threads(id) on delete cascade,
  question             text,
  answer               text,
  is_instructor_answer boolean not null default false,
  upvotes              integer not null default 0,
  accepted             boolean not null default false,
  is_hidden            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_qa_course on public.qa_threads(course_id, created_at desc);
create index if not exists idx_qa_parent on public.qa_threads(parent_id);
select public.touch_updated_at('public.qa_threads');

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.users(id) on delete cascade,
  recipient_id  uuid not null references public.users(id) on delete cascade,
  course_id     uuid references public.courses(id) on delete set null, -- course-related only
  body          text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_msg_pair on public.messages(sender_id, recipient_id, created_at);
create index if not exists idx_msg_recipient on public.messages(recipient_id, read);

create table if not exists public.course_announcements (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  author_id   uuid not null references public.users(id) on delete cascade,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_cann_course on public.course_announcements(course_id, created_at desc);

create table if not exists public.platform_announcements (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.users(id) on delete set null,
  title       text not null,
  body        text,
  level       text not null default 'info' check (level in ('info','success','warning','critical')),
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.touch_updated_at('public.platform_announcements');
