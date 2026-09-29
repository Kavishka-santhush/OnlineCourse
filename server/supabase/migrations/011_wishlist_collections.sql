-- =====================================================================
-- 011 · Wishlist & custom collections (learning paths)
-- =====================================================================

create table if not exists public.wishlist (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  price_at_add   numeric(10,2),          -- snapshot for price-drop alerts
  notified_at    timestamptz,            -- last price-drop notification sent
  created_at     timestamptz not null default now(),
  unique (user_id, course_id)
);
create index if not exists idx_wishlist_user on public.wishlist(user_id);

create table if not exists public.collections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  title        text not null,
  description  text,
  cover_url    text,
  is_public    boolean not null default false,
  share_token  text unique default substr(replace(gen_random_uuid()::text,'-',''),1,16),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select public.touch_updated_at('public.collections');

create table if not exists public.collection_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  position      integer not null default 1,
  created_at    timestamptz not null default now(),
  unique (collection_id, course_id)
);
