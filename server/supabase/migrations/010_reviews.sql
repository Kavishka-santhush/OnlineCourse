-- =====================================================================
-- 010 · Reviews, ratings, helpful votes, AI summaries & content flags
-- =====================================================================

create table if not exists public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  rating              integer not null check (rating between 1 and 5),
  body                text,
  is_verified         boolean not null default false,   -- verified enrollment badge
  instructor_response text,
  responded_at        timestamptz,
  helpful_count       integer not null default 0,
  reported            boolean not null default false,
  is_hidden           boolean not null default false,   -- hidden by moderator
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists idx_reviews_course on public.reviews(course_id) where is_hidden = false;
select public.touch_updated_at('public.reviews');

create table if not exists public.review_votes (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (review_id, user_id)
);

-- Cached AI review summarisation + sentiment breakdown per course
create table if not exists public.review_summaries (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null unique references public.courses(id) on delete cascade,
  summary         text,
  sentiment       jsonb not null default '{}'::jsonb, -- {positive,neutral,negative}
  top_praises     jsonb not null default '[]'::jsonb,
  top_complaints  jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select public.touch_updated_at('public.review_summaries');

-- User-reported abusive content (courses, reviews, Q&A) -> moderator queue
create table if not exists public.flags (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('course','review','question','answer','message')),
  entity_id     uuid not null,
  reporter_id   uuid references public.users(id) on delete set null,
  reason        text,
  status        text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution    text,
  resolved_by   uuid references public.users(id),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_flags_status on public.flags(status, created_at desc);
