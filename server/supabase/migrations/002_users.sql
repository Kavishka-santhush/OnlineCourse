-- =====================================================================
-- 002 · Users (synced from Clerk) & notification preferences
-- =====================================================================

create table if not exists public.users (
  id                     uuid primary key default gen_random_uuid(),
  clerk_id               text unique,                       -- Clerk user id (auth is owned by Clerk)
  email                  citext unique,
  username               text unique not null,
  display_name           text not null,
  avatar_url             text,
  avatar_path            text,
  bio                    text,
  website                text,
  social_links           jsonb not null default '{}'::jsonb, -- {twitter,linkedin,github,facebook}
  timezone               text default 'UTC',
  language               text default 'en',
  privacy_settings       jsonb not null default '{"profile_public":true,"show_enrollments":false}'::jsonb,

  -- role: student (default) < instructor < moderator < admin < super_admin
  role                   text not null default 'student'
            check (role in ('student','instructor','moderator','admin','super_admin')),

  -- instructor fields
  is_verified_instructor boolean not null default false,
  instructor_tier        text not null default 'new'
            check (instructor_tier in ('new','rising','pro','elite')),
  instructor_rating      numeric(3,2) not null default 0,
  stripe_account_id      text,      -- Stripe Connect (payouts)
  stripe_customer_id     text,      -- Stripe subscriptions

  -- moderation
  is_suspended           boolean not null default false,
  suspension_reason      text,
  referral_code          text unique,
  onboarded              boolean not null default false,
  deleted_at             timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_users_role        on public.users(role);
create index if not exists idx_users_clerk       on public.users(clerk_id);
create index if not exists idx_users_email       on public.users(email);
create index if not exists idx_users_referral    on public.users(referral_code);
select public.touch_updated_at('public.users');

-- Notification preferences per user per type --------------------------
create table if not exists public.notification_preferences (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,     -- purchase, new_lesson, certificate, ...
  in_app      boolean not null default true,
  email       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, type)
);
select public.touch_updated_at('public.notification_preferences');

-- User activity log ---------------------------------------------------
create table if not exists public.user_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  action      text not null,
  description text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_activity_user on public.user_activity(user_id, created_at desc);

-- Instructor applications --------------------------------------------
create table if not exists public.instructor_applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  bio               text not null,
  expertise         jsonb not null default '[]'::jsonb,
  experience        text,
  sample_content_url text,
  status            text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_reason   text,
  reviewed_by       uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_applications_status on public.instructor_applications(status);
select public.touch_updated_at('public.instructor_applications');
