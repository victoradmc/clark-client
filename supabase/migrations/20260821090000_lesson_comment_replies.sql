-- Reply to a Comment (ticket 05). A separate table from lesson_comments,
-- not a self-referencing parent_id — see ADR 0006: this makes
-- replying-to-a-reply structurally impossible (lesson_comment_replies only
-- references lesson_comments, never itself), not just policy-enforced.

create table public.lesson_comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.lesson_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint lesson_comment_replies_body_length
    check ( char_length(btrim(body)) > 0 and char_length(body) <= 2000 )
);

alter table public.lesson_comment_replies enable row level security;

-- Same broad-grant-then-narrow-with-RLS convention as lesson_comments.sql.
-- Unlike Comments, Replies genuinely have no children to protect (ADR
-- 0008), so delete here is a real DELETE, not an UPDATE — the delete grant
-- is present, and there's no deleted_at column at all.
grant select, insert, update, delete on public.lesson_comment_replies to authenticated, service_role;

-- ── lesson_comment_replies policies ─────────────────────────────────────
-- Visibility follows the parent Comment's Lesson — same shape as
-- lesson_comments' own visibility check, just one join further out.

create policy "lesson_comment_replies_select_visible_lesson"
on public.lesson_comment_replies for select
to authenticated
using (
  exists (
    select 1 from public.lesson_comments c
    join public.lessons l on l.id = c.lesson_id
    where c.id = comment_id
      and (l.visibility = 'public' or l.owner_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy "lesson_comment_replies_insert_own_visible_lesson"
on public.lesson_comment_replies for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.lesson_comments c
    join public.lessons l on l.id = c.lesson_id
    where c.id = comment_id
      and (l.visibility = 'public' or l.owner_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

-- Update is author-only — unlike Comments, an Admin never needs UPDATE
-- access here at all: Replies hard-delete via a real DELETE statement, so
-- there's no soft-delete-via-update path for Admin moderation to piggyback
-- on (contrast lesson_comments_update_own_or_admin_delete).
create policy "lesson_comment_replies_update_own"
on public.lesson_comment_replies for update
to authenticated
using ( author_id = auth.uid() )
with check ( author_id = auth.uid() );

-- Delete allowed for the author or an Admin — same moderation backstop as
-- Comments, but here it's the real delete path since Replies have no
-- tombstone (ADR 0008).
create policy "lesson_comment_replies_delete_own_or_admin"
on public.lesson_comment_replies for delete
to authenticated
using ( author_id = auth.uid() or public.is_admin(auth.uid()) );

-- comment_id is made immutable here too — the update policy's with-check
-- already pins author_id to the caller, but says nothing about comment_id,
-- so without this a caller could otherwise move their own Reply under a
-- different Comment via a crafted PATCH. Mirrors
-- lesson_comments.enforce_comment_update_rules for the same reason.
create or replace function public.enforce_reply_update_rules()
returns trigger
language plpgsql
as $$
begin
  if NEW.comment_id <> OLD.comment_id or NEW.author_id <> OLD.author_id then
    raise exception 'comment_id and author_id cannot be changed.';
  end if;
  return NEW;
end;
$$;

create trigger lesson_comment_replies_update_rules
before update on public.lesson_comment_replies
for each row execute function public.enforce_reply_update_rules();
