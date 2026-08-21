-- Take Notes (ticket 03). One private freeform text Note per (Account,
-- Lesson) — deliberately breaks from the Star precedent (ADR 0009): RLS
-- grants the owning Account select/insert/update/delete on its own row and
-- nothing else, with no Admin select policy at all. lessons.notes_count is
-- a denormalized counter kept in sync by a trigger, mirroring star_count
-- (ADR 0007) exactly.

create table public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  updated_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

alter table public.lesson_notes enable row level security;

alter table public.lessons add column notes_count integer not null default 0;

-- Same broad-grant-then-narrow-with-RLS convention as lesson_stars. Unlike
-- lesson_stars, this includes update — a Note is overwritten in place on
-- every save (spec), not just inserted/deleted.
grant select, insert, update, delete on public.lesson_notes to authenticated, service_role;

-- ── lesson_notes policies ───────────────────────────────────────────────
-- No Admin exception anywhere below — the deliberate deviation from
-- lesson_stars_select_own_or_admin (ADR 0009). A Note is unreadable by any
-- Account other than its author, through any code path, including Admin.

create policy "lesson_notes_select_own"
on public.lesson_notes for select
to authenticated
using ( user_id = auth.uid() );

-- Mirrors lesson_stars_insert_own_visible_lesson: a Note can only be taken
-- on a Lesson the caller could already view (public, own, or Admin) — same
-- visibility rule, checked here rather than trusted from the client.
create policy "lesson_notes_insert_own_visible_lesson"
on public.lesson_notes for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.lessons
    where id = lesson_id
      and (visibility = 'public' or owner_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "lesson_notes_update_own"
on public.lesson_notes for update
to authenticated
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );

create policy "lesson_notes_delete_own"
on public.lesson_notes for delete
to authenticated
using ( user_id = auth.uid() );

-- ── notes_count sync trigger ────────────────────────────────────────────
-- security definer for the same reason as sync_lesson_star_count: the
-- caller taking a Note on someone else's public Lesson has no UPDATE grant
-- on lessons (lessons_update_own_or_admin is owner/admin-only), so this
-- needs to bypass lessons RLS to touch notes_count. Only insert/delete
-- change the count — an update (overwriting a Note's text) never does.

create or replace function public.sync_lesson_notes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.lessons set notes_count = notes_count + 1 where id = NEW.lesson_id;
    return NEW;
  else
    update public.lessons set notes_count = notes_count - 1 where id = OLD.lesson_id;
    return OLD;
  end if;
end;
$$;

create trigger lesson_notes_sync_count
after insert or delete on public.lesson_notes
for each row execute function public.sync_lesson_notes_count();
