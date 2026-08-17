-- Access Request (ticket 03). Clark's first unauthenticated database write
-- — see ADR 0003 for why a public INSERT policy here is a deliberate,
-- accepted trade-off rather than an oversight.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text,
  created_at timestamptz not null default now()
);

alter table public.access_requests enable row level security;

-- anon has no schema-level grant anywhere else in this project (see
-- initial_schema.sql's header comment) — this is the one place that changes,
-- and only for this one table/operation.
grant usage on schema public to anon;
grant insert on public.access_requests to anon;

-- Same broad-grant-then-narrow-with-RLS convention as every other table:
-- authenticated has full table privilege, but only the insert/select/delete
-- policies below actually admit anything — no update policy exists, so
-- that's denied regardless of the grant. No update path exists for Access
-- Requests: approve/reject only ever delete a row, never modify one.
grant select, insert, update, delete on public.access_requests to authenticated, service_role;

create policy "access_requests_insert_anyone"
on public.access_requests for insert
to anon, authenticated
with check ( true );

-- Needed for two reasons: it's what the spec literally asks for ("SELECT ...
-- restricted to Admin Role"), and Postgres requires SELECT privilege for a
-- DELETE ... RETURNING to hand the deleted row back — without this,
-- approveAccessRequest/rejectAccessRequest's `.delete().select().single()`
-- would see 0 visible rows and fail to coerce, even though the delete itself
-- succeeded.
create policy "access_requests_select_admin"
on public.access_requests for select
to authenticated
using ( public.is_admin(auth.uid()) );

create policy "access_requests_delete_admin"
on public.access_requests for delete
to authenticated
using ( public.is_admin(auth.uid()) );

-- Rejects an insert up front (before the row is ever written) when either:
--   1. an Account already exists for that email (profiles lookup), or
--   2. an Access Request is already pending for that email.
-- security definer so it can read profiles/access_requests regardless of
-- the caller's own grants — this is the only way an anon caller's insert
-- can be checked against either table, since anon has no select grant on
-- either.
create or replace function public.check_access_request_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where email = NEW.email) then
    raise exception 'An Account already exists for this email.';
  end if;
  if exists (select 1 from public.access_requests where email = NEW.email) then
    raise exception 'An Access Request is already pending for this email.';
  end if;
  return NEW;
end;
$$;

create trigger access_requests_check_eligibility
before insert on public.access_requests
for each row execute function public.check_access_request_eligibility();

-- Admin panel's Pending Requests section read path (ticket 03). Same shape
-- as admin_list_accounts(): a narrow security-definer function that raises
-- for a non-Admin caller, so a non-Admin's list attempt surfaces as a
-- thrown error (matching getAccounts()'s behavior) rather than a plain RLS
-- select's silent empty array.
create or replace function public.admin_list_access_requests()
returns table (id uuid, name text, email text, message text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin only';
  end if;

  return query
    select a.id, a.name, a.email, a.message, a.created_at
    from public.access_requests a
    order by a.created_at asc;
end;
$$;

grant execute on function public.admin_list_access_requests() to authenticated;
