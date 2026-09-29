-- =====================================================================
-- 012 · Orders, payments, payouts, coupons, promotions, loyalty & referrals
-- =====================================================================

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  status              text not null default 'pending'
        check (status in ('pending','paid','failed','refunded','cancelled')),
  currency            text not null default 'usd',
  subtotal_cents      integer not null default 0,
  discount_cents      integer not null default 0,
  total_cents         integer not null default 0,
  commission_percent  numeric(5,2) not null default 20,
  commission_cents    integer not null default 0,
  payment_intent_id   text,
  coupon_id           uuid,
  gift_to_email       citext,
  items               jsonb not null default '[]'::jsonb, -- [{course_id,title,price_cents,instructor_id}]
  paid_at             timestamptz,
  refunded_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_orders_user   on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);
select public.touch_updated_at('public.orders');

create table if not exists public.order_items (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references public.orders(id) on delete cascade,
  course_id                uuid not null references public.courses(id) on delete cascade,
  price_cents              integer not null default 0,
  instructor_earnings_cents integer not null default 0,
  created_at               timestamptz not null default now()
);
create index if not exists idx_oi_order  on public.order_items(order_id);
create index if not exists idx_oi_course on public.order_items(course_id);

-- now that orders exists, wire enrollments.order_id -> orders
do $$ begin
  alter table public.enrollments
    add constraint fk_enrollments_order foreign key (order_id) references public.orders(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.refund_requests (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  amount_cents  integer not null default 0,
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','declined')),
  resolved_by   uuid references public.users(id),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_refund_status on public.refund_requests(status);

create table if not exists public.payouts (
  id             uuid primary key default gen_random_uuid(),
  instructor_id  uuid not null references public.users(id) on delete cascade,
  amount_cents   integer not null default 0,
  currency       text not null default 'usd',
  method         text not null default 'bank' check (method in ('bank','paypal')),
  status         text not null default 'pending'
     check (status in ('pending','processing','paid','rejected','failed')),
  processed_by   uuid references public.users(id),
  processed_at   timestamptz,
  stripe_transfer_id text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_payout_instr on public.payouts(instructor_id, created_at desc);

-- ---------------------------------------------------------------------
-- Coupons (instructor course coupons + platform coupons + subscription)
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  scope                    text not null default 'course' check (scope in ('course','platform','subscription')),
  course_id                uuid references public.courses(id) on delete cascade,
  applicable_instructor_id uuid references public.users(id) on delete cascade,
  percent_off              integer,                 -- 1..100
  amount_off               integer,                 -- cents
  min_order_cents          integer,
  max_redemptions          integer,
  redeemed_count           integer not null default 0,
  expires_at               timestamptz,
  is_active                boolean not null default true,
  created_by               uuid references public.users(id),
  created_at               timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id             uuid primary key default gen_random_uuid(),
  coupon_id      uuid not null references public.coupons(id) on delete cascade,
  user_id        uuid references public.users(id) on delete set null,
  discount_cents integer not null default 0,
  created_at     timestamptz not null default now()
);
do $$ begin
  alter table public.orders
    add constraint fk_orders_coupon foreign key (coupon_id) references public.coupons(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Platform promotions (flash sales), loyalty points & referrals
-- ---------------------------------------------------------------------
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  percent_off integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  course_ids  jsonb not null default '[]'::jsonb,
  coupon_code text,
  active      boolean not null default true,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.loyalty_points (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  balance         integer not null default 0,
  lifetime_points integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select public.touch_updated_at('public.loyalty_points');

create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.users(id) on delete cascade,
  referee_id   uuid references public.users(id) on delete set null,
  code         text not null,
  status       text not null default 'pending' check (status in ('pending','signed_up','purchased','rewarded')),
  reward_cents integer not null default 0,
  created_at   timestamptz not null default now()
);
