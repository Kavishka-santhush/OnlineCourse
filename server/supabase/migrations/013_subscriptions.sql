-- =====================================================================
-- 013 · Subscription plans (Netflix-style) & user subscriptions
-- =====================================================================

create table if not exists public.subscription_plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  description       text,
  price_cents       integer not null default 0,
  currency          text not null default 'usd',
  interval          text not null default 'month' check (interval in ('month','year','week','day')),
  trial_days        integer not null default 0,
  course_access     text not null default 'selected' check (course_access in ('all','selected','none')),
  included_course_ids jsonb not null default '[]'::jsonb,
  team_seats        integer not null default 0,       -- Team/Enterprise seat count
  features          jsonb not null default '[]'::jsonb,
  stripe_product_id text,
  stripe_price_id   text,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select public.touch_updated_at('public.subscription_plans');

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users(id) on delete cascade,
  plan_id                 uuid not null references public.subscription_plans(id) on delete restrict,
  stripe_subscription_id  text unique,
  stripe_customer_id      text,
  status                  text not null default 'incomplete'
     check (status in ('incomplete','trialing','active','past_due','canceled','unpaid','paused')),
  cancel_at_period_end    boolean not null default false,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  seats                   integer not null default 1,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists idx_sub_user on public.subscriptions(user_id);
select public.touch_updated_at('public.subscriptions');
