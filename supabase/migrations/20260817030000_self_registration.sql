-- Self-service Registration (ticket 01, ADR 0004) replaces Access Request
-- and the admin-approval gate it fed. ADR 0004 supersedes ADR 0003.

drop trigger if exists access_requests_check_eligibility on public.access_requests;
drop function if exists public.check_access_request_eligibility();
drop function if exists public.admin_list_access_requests();
drop table if exists public.access_requests;

-- anon only ever had schema usage for the access_requests insert (see that
-- migration's header comment) — nothing anon-facing remains at the
-- Postgres level, so this restores the original "no direct anon access"
-- invariant. Registration itself goes through Supabase Auth's signUp(),
-- not a PostgREST table write, so it needs no schema grant here.
revoke usage on schema public from anon;

-- ── Registration: auto-create a profiles row on signup ─────────────────
-- supabase.auth.signUp() (ADR 0004) inserts directly into auth.users, with
-- no service-role step available afterward to insert a matching profiles
-- row the way the admin-accounts Edge Function does — so a SECURITY
-- DEFINER trigger does it instead. role is hard-pinned to 'student' here,
-- never read from client input, so Registration alone can never produce
-- an Admin. name comes from raw_user_meta_data, set via signUp's
-- `options.data` (see clarkApi.register()).
--
-- This also fires for Admin-direct creation (admin.createUser, ticket 02,
-- ADR 0005) — the Edge Function's own profiles write after that call must
-- become an upsert, not a plain insert, so it overwrites this trigger's
-- default row (name '', role 'student') with the Admin's chosen name/role
-- instead of colliding with it on the primary key.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    'student'
  );
  return NEW;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
