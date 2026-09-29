-- =====================================================================
-- 018 · CMS — blog / resource centre, static pages, FAQs
-- =====================================================================

create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,
  excerpt         text,
  body            text not null,          -- rich text / markdown
  cover_image_url text,
  author_id       uuid references public.users(id) on delete set null,
  tags            text[] not null default '{}',
  is_published    boolean not null default false,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select public.touch_updated_at('public.blog_posts');

create table if not exists public.cms_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,     -- about, contact, terms, privacy
  title       text not null,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.touch_updated_at('public.cms_pages');

create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  category    text not null default 'general',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.touch_updated_at('public.faqs');

-- =====================================================================
-- 019 · Platform settings, audit log, bundles
-- =====================================================================

-- Single-row settings blob (id = 1). Managed by Super Admin.
create table if not exists public.platform_settings (
  id          integer primary key default 1,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 1)
);
insert into public.platform_settings (id, settings) values (1, '{
  "platform_name": "CourseMarket",
  "commission_percent": 20,
  "refund_policy_days": 30,
  "refund_max_completion_percent": 30,
  "payout_min_cents": 5000,
  "default_role": "student",
  "require_instructor_approval": true,
  "ai_enabled": true,
  "subscription_enabled": true,
  "referral_reward_cents": 1000,
  "loyalty_point_value_cents": 1
}'::jsonb) on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.users(id) on delete set null,
  actor_email text,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_time on public.audit_logs(created_at desc);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);

-- Course bundles (buy multiple together at a discount) — Admin approved
create table if not exists public.bundles (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  course_ids     jsonb not null default '[]'::jsonb,
  discount_percent integer not null default 0,
  created_by     uuid references public.users(id),
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
select public.touch_updated_at('public.bundles');
