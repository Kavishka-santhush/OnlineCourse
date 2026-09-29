-- =====================================================================
-- 003 · Categories & subcategories (self-referencing)
-- =====================================================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  parent_id   uuid references public.categories(id) on delete cascade, -- null = top-level category
  icon        text,           -- lucide / emoji identifier used by the frontend
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_active on public.categories(is_active) where is_active = true;
select public.touch_updated_at('public.categories');
