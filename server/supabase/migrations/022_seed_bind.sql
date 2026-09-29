-- =====================================================================
-- 022 · Seed-account binding helper
--
-- The demo accounts created by supabase/seeds/02_users.sql carry a
-- placeholder clerk_id ('seed_*') because Clerk owns authentication and
-- real Clerk user ids are unknown until a person actually signs up.
--
-- After a human registers in Clerk with one of the seeded e-mail
-- addresses, the API links the two identities so the account keeps all
-- of its demo data (courses, enrollments, orders, …) instead of
-- creating a duplicate row.  The Clerk `user.created` webhook calls:
--
--   select public.bind_seed_accounts(p_clerk_id => 'user_2abc…',
--                                    p_email    => 'alice@example.com');
--
-- and, when it returns 1, skips inserting a fresh users row.
-- It returns the number of rows re-bound (0 or 1).
-- =====================================================================

create or replace function public.bind_seed_accounts(
  p_clerk_id text,
  p_email    text
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  moved integer := 0;
begin
  if p_clerk_id is null or p_clerk_id like 'seed_%' then
    return 0;                                    -- nothing to bind
  end if;

  -- Refuse to steal an already-bound account.
  if exists (select 1 from public.users where clerk_id = p_clerk_id) then
    return 0;
  end if;

  update public.users
     set clerk_id = p_clerk_id
   where lower(email) = lower(p_email)
     and clerk_id like 'seed_%'
     and deleted_at is null;
  get moved := sql%rowcount;

  return moved;
end; $$;

revoke all on function public.bind_seed_accounts(text, text) from public;
grant execute on function public.bind_seed_accounts(text, text) to service_role;
