-- Self-service account deletion (ticket 06). profiles has no DELETE policy
-- for the row owner — see the initial migration's comment: profiles rows are
-- meant to be removed only via cascade from deleting the matching auth.users
-- row, which normally requires the service_role-only Auth Admin API. A
-- caller deleting *their own* row needs no additional authorization beyond
-- already being that user, so rather than standing up an Edge Function for
-- this (ADR 0002's Edge Function is scoped to Admin-panel actions — inviting
-- and deleting *other* Accounts, which do need role checks a plain RPC can't
-- self-authorize), a security-definer function deletes directly from
-- auth.users. That cascades auth.users -> profiles -> lessons (both FKs are
-- already `on delete cascade`), removing the profile and every Lesson it
-- owned in one statement.
--
-- auth.role()/auth.uid() read from the request's JWT claims regardless of
-- the security-definer context switch, so the ticket 01 admin-protection
-- trigger still runs as the real caller: an Admin calling this on their own
-- (admin) row is still blocked by "admins cannot delete their own account".

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
