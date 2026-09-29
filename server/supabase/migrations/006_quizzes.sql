-- =====================================================================
-- 006 · Quizzes — quizzes, questions, attempts, reusable question bank
-- =====================================================================

create table if not exists public.quizzes (
  id                    uuid primary key default gen_random_uuid(),
  course_id             uuid references public.courses(id) on delete cascade,
  lesson_id             uuid references public.lessons(id) on delete cascade,
  instructor_id         uuid not null references public.users(id) on delete cascade,
  title                 text not null,
  instructions          text,
  time_limit_minutes    integer not null default 0,     -- 0 = untimed
  max_attempts          integer not null default 0,     -- 0 = unlimited
  passing_score         integer not null default 70,    -- percent
  shuffle_questions     boolean not null default false,
  randomize_options     boolean not null default false,
  show_answers_after    boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_quizzes_course on public.quizzes(course_id);
select public.touch_updated_at('public.quizzes');

create table if not exists public.quiz_questions (
  id               uuid primary key default gen_random_uuid(),
  quiz_id          uuid not null references public.quizzes(id) on delete cascade,
  type             text not null check (type in ('multiple_choice','true_false','multiple_select','short_answer','code')),
  prompt           text not null,
  options          jsonb not null default '[]'::jsonb,   -- string[]
  correct_answers  jsonb not null default '[]'::jsonb,   -- number[] (indexes) or string[]
  explanation      text,
  points           integer not null default 1,
  difficulty       text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  position         integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_qq_quiz on public.quiz_questions(quiz_id, position);
select public.touch_updated_at('public.quiz_questions');

create table if not exists public.quiz_attempts (
  id                   uuid primary key default gen_random_uuid(),
  quiz_id              uuid not null references public.quizzes(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete cascade,
  attempt_number       integer not null default 1,
  status               text not null default 'in_progress'
         check (status in ('in_progress','submitted','pending_grading','graded')),
  answers              jsonb not null default '{}'::jsonb,   -- {question_id: value|array}
  auto_score           integer,
  score                integer,
  passed               boolean,
  needs_manual_grading jsonb not null default '[]'::jsonb,
  manual_grades        jsonb not null default '{}'::jsonb,   -- {question_id:{score,feedback}}
  overall_feedback     text,
  started_at           timestamptz,
  submitted_at         timestamptz,
  graded_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_attempts_quiz_user on public.quiz_attempts(quiz_id, user_id);
select public.touch_updated_at('public.quiz_attempts');

create table if not exists public.question_bank (
  id               uuid primary key default gen_random_uuid(),
  instructor_id    uuid not null references public.users(id) on delete cascade,
  type             text not null,
  prompt           text not null,
  options          jsonb not null default '[]'::jsonb,
  correct_answers  jsonb not null default '[]'::jsonb,
  explanation      text,
  difficulty       text not null default 'medium',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_bank_instructor on public.question_bank(instructor_id);
select public.touch_updated_at('public.question_bank');
