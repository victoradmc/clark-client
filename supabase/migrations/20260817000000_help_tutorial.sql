-- Help page's Tutorial tab (ticket 01). A singleton row (id always 1, seeded
-- below) rather than a real primary key per Account/lesson — spec's data
-- model: one Markdown document, overwritten in place, no history kept.

create table public.help_tutorial (
  id integer primary key default 1 check (id = 1),
  content text not null default ''
);

alter table public.help_tutorial enable row level security;

-- Same broad-grant-then-narrow-with-RLS convention as initial_schema.sql:
-- authenticated has insert/delete table privilege, but no policy below
-- grants either, so RLS denies both for every authenticated caller.
grant select, insert, update, delete on public.help_tutorial to authenticated, service_role;

create policy "help_tutorial_select_authenticated"
on public.help_tutorial for select
to authenticated
using ( true );

create policy "help_tutorial_update_admin"
on public.help_tutorial for update
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- Seeded content is empty, not placeholder copy — HelpScreen renders its own
-- placeholder message client-side when content is blank (spec AC: "sensible
-- placeholder content" is a display concern, not stored data).
insert into public.help_tutorial (id, content) values (1, '');
