-- Star a Lesson (ticket 01). One Star per (Account, Lesson), toggleable.
-- lessons.star_count is a denormalized counter kept in sync by a trigger
-- rather than computed live (ADR 0007) — the hot read path (Hub/My Library
-- list sorting, ticket 02/03) needs a cheap, indexable ORDER BY.

create table public.lesson_stars (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

alter table public.lesson_stars enable row level security;

alter table public.lessons add column star_count integer not null default 0;

-- Same broad-grant-then-narrow-with-RLS convention as initial_schema.sql.
-- No update grant: a Star is only ever inserted or deleted, never edited in
-- place.
grant select, insert, delete on public.lesson_stars to authenticated, service_role;

-- ── lesson_stars policies ───────────────────────────────────────────────
-- No Account can list who else starred a Lesson (spec) — select is scoped
-- to the caller's own row, or any row for an Admin.

create policy "lesson_stars_select_own_or_admin"
on public.lesson_stars for select
to authenticated
using ( user_id = auth.uid() or public.is_admin(auth.uid()) );

-- Mirrors lessons_select_public_own_or_admin: starring is only possible on
-- a Lesson the caller could already see (public, own, or Admin) — same
-- visibility rule, checked here rather than trusted from the client.
create policy "lesson_stars_insert_own_visible_lesson"
on public.lesson_stars for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.lessons
    where id = lesson_id
      and (visibility = 'public' or owner_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "lesson_stars_delete_own"
on public.lesson_stars for delete
to authenticated
using ( user_id = auth.uid() );

-- ── star_count sync trigger ─────────────────────────────────────────────
-- security definer: the caller starring someone else's public Lesson has no
-- UPDATE grant on lessons (lessons_update_own_or_admin is owner/admin-only),
-- so this needs to bypass lessons RLS to touch star_count, same reasoning as
-- protect_admin_rows() in initial_schema.sql.

create or replace function public.sync_lesson_star_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.lessons set star_count = star_count + 1 where id = NEW.lesson_id;
    return NEW;
  else
    update public.lessons set star_count = star_count - 1 where id = OLD.lesson_id;
    return OLD;
  end if;
end;
$$;

create trigger lesson_stars_sync_count
after insert or delete on public.lesson_stars
for each row execute function public.sync_lesson_star_count();

-- ── toggle RPC ───────────────────────────────────────────────────────────
-- security invoker (the default — no `security definer` here): the actual
-- authorization is the lesson_stars RLS policies above, applied as the real
-- caller. This function exists only to make "delete my row if it exists,
-- else insert it, then report the resulting state" one atomic round trip
-- instead of a check-then-act the client would have to orchestrate itself.

create or replace function public.toggle_lesson_star(p_lesson_id uuid)
returns table (starred boolean, star_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted uuid;
begin
  delete from public.lesson_stars
  where lesson_id = p_lesson_id and user_id = v_uid
  returning id into v_deleted;

  if v_deleted is not null then
    starred := false;
  else
    insert into public.lesson_stars (lesson_id, user_id) values (p_lesson_id, v_uid);
    starred := true;
  end if;

  select l.star_count into star_count from public.lessons l where l.id = p_lesson_id;
  return next;
end;
$$;

grant execute on function public.toggle_lesson_star(uuid) to authenticated;
