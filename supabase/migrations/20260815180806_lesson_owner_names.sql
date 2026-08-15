-- Lesson view/cards need to show a Lesson's Owner display name (spec.md
-- user stories 5 & 13), but profiles RLS only lets an Account read its own
-- row (or all rows if Admin) — it says nothing about reading another
-- Account's row just to attribute a Lesson. Rather than broadening profiles
-- RLS (which would expose the owner's email/bio/role too) or denormalizing
-- an owner_name column onto lessons (spec.md's data model doesn't have
-- one), this is a narrow security-definer function: id + name only, never
-- any other profiles column, regardless of Lesson visibility.

create or replace function public.get_profile_names(ids uuid[])
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name from public.profiles where id = any(ids);
$$;

grant execute on function public.get_profile_names(uuid[]) to authenticated;
