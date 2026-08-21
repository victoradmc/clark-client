-- Subject browsing (ticket 02): Home's "Browse by subject" cards and the
-- new `/subject/:name` page. Subject stays free text (ADR 0010) — instead
-- of a real entity, this adds a normalization helper both new RPCs share,
-- so the subjects-summary list and the Subject page's own Lesson query can
-- never disagree on what counts as "the same" Subject. The Hub's existing
-- exact-match Subject filter is untouched.

create or replace function public.normalize_subject(p_subject text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(trim(p_subject));
$$;

grant execute on function public.normalize_subject(text) to authenticated;

-- Groups every Lesson visible to the caller under Home's Public+own scope
-- (deliberately narrower than plain lessons RLS, which would additionally
-- let an Admin see every private Lesson here too — see
-- lessons_select_public_own_or_admin) by normalized Subject, returning one
-- representative original-casing label per group (its most recently
-- created Lesson's literal Subject text) alongside the group's count.
-- Ordered by the normalized label so results are already alphabetical.

create or replace function public.get_subject_summaries()
returns table (subject text, lesson_count integer)
language sql
stable
set search_path = public
as $$
  with visible as (
    select subject, created_at
    from public.lessons
    where visibility = 'public' or owner_id = auth.uid()
  ),
  grouped as (
    select
      normalize_subject(subject) as norm_subject,
      count(*)::integer as lesson_count,
      (array_agg(subject order by created_at desc))[1] as subject
    from visible
    group by normalize_subject(subject)
  )
  select subject, lesson_count
  from grouped
  order by norm_subject;
$$;

grant execute on function public.get_subject_summaries() to authenticated;

-- The Subject page's own Lesson query: same Public+own visibility scope as
-- get_subject_summaries above (and the Hub's combined view), matched
-- against the normalized Subject rather than the exact string, newest
-- first. `p_subject` is whatever the URL's :name segment decodes to —
-- an unrecognized or empty Subject simply matches zero rows rather than
-- erroring, which is what lets the Subject page render an empty state
-- instead of redirecting.

create or replace function public.get_lessons_for_subject(p_subject text)
returns setof public.lessons
language sql
stable
set search_path = public
as $$
  select *
  from public.lessons
  where normalize_subject(subject) = normalize_subject(p_subject)
    and (visibility = 'public' or owner_id = auth.uid())
  order by created_at desc;
$$;

grant execute on function public.get_lessons_for_subject(text) to authenticated;
