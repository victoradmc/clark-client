-- Comment on a Lesson (ticket 04). Soft-delete via deleted_at rather than a
-- hard row delete — a Comment has no Replies yet in this migration, but
-- ticket 05 attaches lesson_comment_replies to lesson_comments.id, and a
-- hard delete here would orphan/cascade those away. See ADR 0008.

create table public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lesson_comments_body_length
    check ( char_length(btrim(body)) > 0 and char_length(body) <= 2000 )
);

alter table public.lesson_comments enable row level security;

-- Same broad-grant-then-narrow-with-RLS convention as initial_schema.sql /
-- lesson_stars.sql. No delete grant to `authenticated` at the table level —
-- deletion here is exclusively the soft-delete path via UPDATE
-- (deleted_at), matching the update grant below; the row itself is never
-- actually removed by a client.
grant select, insert, update on public.lesson_comments to authenticated, service_role;

-- ── lesson_comments policies ────────────────────────────────────────────
-- Visibility mirrors lessons_select_public_own_or_admin exactly: an Account
-- can only read/write Comments on a Lesson it could already see.

create policy "lesson_comments_select_visible_lesson"
on public.lesson_comments for select
to authenticated
using (
  exists (
    select 1 from public.lessons
    where id = lesson_id
      and (visibility = 'public' or owner_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "lesson_comments_insert_own_visible_lesson"
on public.lesson_comments for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.lessons
    where id = lesson_id
      and (visibility = 'public' or owner_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

-- Update is the mechanism for both an edit (author changes body) and a
-- soft-delete (author or Admin sets deleted_at) — the two are told apart by
-- which columns the client actually sends, not by separate policies. An
-- Admin can reach this policy's using-clause (so they can set deleted_at),
-- but see the trigger below for why they still can't edit `body`.
create policy "lesson_comments_update_own_or_admin_delete"
on public.lesson_comments for update
to authenticated
using ( author_id = auth.uid() or public.is_admin(auth.uid()) )
with check ( author_id = auth.uid() or public.is_admin(auth.uid()) );

-- No delete policy: rows are only ever soft-deleted via the update policy
-- above.

-- ── Update-rule enforcement ─────────────────────────────────────────────
-- RLS's update policy alone would let an Admin edit `body` on someone
-- else's Comment (ADR/spec: Admin gets delete only, never edit — see
-- ADR 0008 and the existing lessons precedent), and would let anyone move a
-- Comment to a different Lesson or reassign its author via a crafted PATCH.
-- This trigger closes both gaps: lesson_id/author_id are immutable for
-- everyone, and only the original author may change `body`.
create or replace function public.enforce_comment_update_rules()
returns trigger
language plpgsql
as $$
begin
  if NEW.lesson_id <> OLD.lesson_id or NEW.author_id <> OLD.author_id then
    raise exception 'lesson_id and author_id cannot be changed.';
  end if;
  if OLD.author_id <> auth.uid() and NEW.body <> OLD.body then
    raise exception 'Only the author may edit a Comment; others may only delete it.';
  end if;
  return NEW;
end;
$$;

create trigger lesson_comments_update_rules
before update on public.lesson_comments
for each row execute function public.enforce_comment_update_rules();
