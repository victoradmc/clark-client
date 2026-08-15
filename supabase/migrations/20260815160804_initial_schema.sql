-- Clark foundation schema: profiles, lessons, RLS policies, and the
-- last-admin protection trigger. See .scratch/clark-mvp/issues/01-foundation.md.

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  bio text not null default '',
  role text not null default 'student' check (role in ('student', 'admin'))
);

alter table public.profiles enable row level security;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  subject text not null,
  origin text not null default 'Unknown',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  test jsonb,
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

-- ── Data API grants ─────────────────────────────────────────────────────
-- This project's Postgres defaults to NOT auto-exposing new tables to the
-- Data API roles (see supabase/config.toml's `auto_expose_new_tables`), so
-- table-level grants are required in addition to the RLS policies below —
-- RLS alone doesn't matter if the role has no grant to reach the table at
-- all. `anon` is deliberately granted nothing on either table: it has no
-- policies below either, so it would see zero rows regardless, but omitting
-- the grant makes "no unauthenticated access" true at both layers.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.lessons to authenticated, service_role;

-- ── Helpers ─────────────────────────────────────────────────────────────

-- security definer so it reads every profiles row regardless of the
-- caller's own RLS visibility, avoiding "infinite recursion detected in
-- policy" from a self-referencing profiles subquery inside a profiles policy.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

-- ── profiles policies ───────────────────────────────────────────────────
-- No policy is granted `to anon` anywhere in this migration, so
-- unauthenticated requests match zero policies and see zero rows.

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using ( id = auth.uid() or public.is_admin(auth.uid()) );

create policy "profiles_update_own_or_admin"
on public.profiles for update
to authenticated
using ( id = auth.uid() or public.is_admin(auth.uid()) )
with check ( id = auth.uid() or public.is_admin(auth.uid()) );

-- No insert/delete policy: profiles rows are created by the admin-invite
-- Edge Function and the first-admin seed step (both via service_role, which
-- bypasses RLS), and removed only by the cascade from deleting the matching
-- auth.users row (also service_role) — never a direct client write.

-- ── lessons policies ────────────────────────────────────────────────────

create policy "lessons_select_public_own_or_admin"
on public.lessons for select
to authenticated
using ( visibility = 'public' or owner_id = auth.uid() or public.is_admin(auth.uid()) );

create policy "lessons_insert_own"
on public.lessons for insert
to authenticated
with check ( owner_id = auth.uid() );

create policy "lessons_update_own_or_admin"
on public.lessons for update
to authenticated
using ( owner_id = auth.uid() or public.is_admin(auth.uid()) )
with check ( owner_id = auth.uid() or public.is_admin(auth.uid()) );

create policy "lessons_delete_own_or_admin"
on public.lessons for delete
to authenticated
using ( owner_id = auth.uid() or public.is_admin(auth.uid()) );

-- ── Admin protection trigger ────────────────────────────────────────────
-- Blocks two things regardless of RLS (so it also holds under a future
-- service_role Edge Function call, per ADR 0002):
--   1. Removing the `admin` role from, or deleting, the last remaining
--      Admin profile.
--   2. An Admin changing their own role or deleting their own row.
-- It also blocks a non-admin from changing anyone's role at all (RLS alone
-- would let a Student PATCH their own row's `role`, since the owner-update
-- policy above has no column-level restriction).

create or replace function public.protect_admin_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_uid uuid := auth.uid();
  -- service_role is a trusted backend context (ADR 0002), not "an Admin
  -- acting" — it's exempt from the self/only-admins-change-role checks
  -- below, but never from the last-remaining-admin count check.
  is_service boolean := auth.role() = 'service_role';
  remaining_admins integer;
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'admin' then
      if not is_service and acting_uid = OLD.id then
        raise exception 'admins cannot delete their own account';
      end if;
      select count(*) into remaining_admins
        from public.profiles where role = 'admin' and id <> OLD.id;
      if remaining_admins = 0 then
        raise exception 'cannot delete the last remaining admin';
      end if;
    end if;
    return OLD;
  end if;

  if TG_OP = 'UPDATE' and NEW.role is distinct from OLD.role then
    if not is_service and not public.is_admin(acting_uid) then
      raise exception 'only admins can change a profile role';
    end if;
    if OLD.role = 'admin' then
      if not is_service and acting_uid = OLD.id then
        raise exception 'admins cannot remove their own admin role';
      end if;
      select count(*) into remaining_admins
        from public.profiles where role = 'admin' and id <> OLD.id;
      if remaining_admins = 0 then
        raise exception 'cannot remove the admin role from the last remaining admin';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

create trigger profiles_protect_admin
before update or delete on public.profiles
for each row execute function public.protect_admin_rows();
