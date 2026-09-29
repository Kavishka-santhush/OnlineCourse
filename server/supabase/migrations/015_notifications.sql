-- =====================================================================
-- 015 · In-app notifications (streamed via Supabase Realtime)
-- =====================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(user_id, read, created_at desc);

-- Enable Realtime so the frontend can subscribe to `postgres_changes`
-- filtered by user_id. (RLS in 020 restricts visibility to the owner.)
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;
