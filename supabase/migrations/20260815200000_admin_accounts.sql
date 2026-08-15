-- Admin Accounts tab (ticket 07) read path. profiles RLS already lets an
-- Admin select every row (profiles_select_own_or_admin), but Status
-- (Active/Invited) is computed from auth.users.last_sign_in_at, which isn't
-- reachable through a plain client query — same reasoning as
-- get_profile_names: a narrow security-definer function, not broadened RLS.
-- Unlike get_profile_names (any authenticated caller, name only), this
-- exposes every Account's email, so the function itself enforces the
-- Admin-only restriction rather than relying on the `grant` alone.

create or replace function public.admin_list_accounts()
returns table (id uuid, name text, email text, role text, status text)
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
    select
      p.id,
      p.name,
      p.email,
      p.role,
      case when u.last_sign_in_at is not null then 'active' else 'invited' end as status
    from public.profiles p
    join auth.users u on u.id = p.id;
end;
$$;

grant execute on function public.admin_list_accounts() to authenticated;
