-- =====================================================================
-- 017 · AI features — usage monitoring & tutor chat history (OpenRouter)
-- =====================================================================

create table if not exists public.ai_usage (
  id                uuid primary key default gen_random_uuid(),
  feature           text not null,      -- recommendations, ai_tutor, quiz_gen, ...
  user_id           uuid references public.users(id) on delete set null,
  course_id         uuid references public.courses(id) on delete set null,
  model             text,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  latency_ms        integer not null default 0,
  success           boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists idx_ai_usage_time    on public.ai_usage(created_at desc);
create index if not exists idx_ai_usage_feature on public.ai_usage(feature);

create table if not exists public.ai_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid references public.courses(id) on delete cascade,
  role        text not null check (role in ('user','assistant','system')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ai_chat_user_course on public.ai_chat_messages(user_id, course_id, created_at);
