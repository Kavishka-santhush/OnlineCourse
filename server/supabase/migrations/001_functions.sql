-- =====================================================================
-- 001 · Extensions, shared functions & triggers
-- Online Course Marketplace Platform — Supabase (PostgreSQL)
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
-- =====================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive email
create extension if not exists "pg_trgm";        -- fuzzy search / ilike indexes

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance trigger function
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- Attach updated_at trigger to a table (called at the bottom of each file)
create or replace function public.touch_updated_at(tab text)
returns void language plpgsql as $$
begin
  execute format('drop trigger if exists trg_%1$s_updated_at on %1$I', tab);
  execute format('create trigger trg_%1$s_updated_at before update on %1$I for each row execute function public.set_updated_at()', tab);
end; $$;

-- ---------------------------------------------------------------------
-- Course search vector + trigger
-- ---------------------------------------------------------------------
create or replace function public.course_search_vector(courses) returns tsvector language plpgsql immutable as $$
begin
  return setweight(to_tsvector('english', coalesce($1.title, '')), 'A')
      || setweight(to_tsvector('english', coalesce($1.subtitle, '')), 'B')
      || setweight(to_tsvector('english', coalesce($1.description, '')), 'C')
      || setweight(to_tsvector('english', coalesce(array_to_string($1.tags, ' '), '')), 'B');
end; $$;

-- ---------------------------------------------------------------------
-- Full-text course search RPC used by GET /api/search
-- ---------------------------------------------------------------------
create or replace function public.search_courses(
  search_term text default '',
  filter_category uuid default null,
  filter_level text default null,
  filter_language text default null,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  id uuid, title text, slug text, subtitle text, thumbnail_url text,
  price numeric, is_free boolean, level text, language text,
  rating_avg numeric, rating_count integer, enrollment_count integer,
  category_id uuid, instructor_id uuid,
  category_name text, instructor_name text,
  rank double precision
)
language sql stable as $$
  select
    c.id, c.title, c.slug, c.subtitle, c.thumbnail_url, c.price, c.is_free,
    c.level, c.language, c.rating_avg, c.rating_count, c.enrollment_count,
    c.category_id, c.instructor_id,
    cat.name as category_name, u.display_name as instructor_name,
    ts_rank(c.search_vector, plainto_tsquery('english', search_term)) as rank
  from courses c
  left join categories cat on cat.id = c.category_id
  left join users u on u.id = c.instructor_id
  where c.status = 'published'
    and (search_term = '' or c.search_vector @@ plainto_tsquery('english', search_term))
    and (filter_category is null or c.category_id = filter_category)
    and (filter_level    is null or c.level = filter_level)
    and (filter_language is null or c.language = filter_language)
  order by
    case when search_term <> '' then rank end desc nulls last,
    c.rating_avg desc, c.enrollment_count desc
  limit result_limit offset result_offset;
$$;
