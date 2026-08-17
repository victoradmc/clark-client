-- Help page's Changelog tab (ticket 02). Unlike the Tutorial's singleton
-- row, this is a real multi-row table — an ordered list of Changelog
-- Entries, each set by the Admin who creates it (spec's data-model
-- decision). No history: an update overwrites a row in place.

create table public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  entry_date date not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.changelog_entries enable row level security;

-- Same broad-grant-then-narrow-with-RLS convention as help_tutorial /
-- initial_schema.sql.
grant select, insert, update, delete on public.changelog_entries to authenticated, service_role;

create policy "changelog_entries_select_authenticated"
on public.changelog_entries for select
to authenticated
using ( true );

create policy "changelog_entries_insert_admin"
on public.changelog_entries for insert
to authenticated
with check ( public.is_admin(auth.uid()) );

create policy "changelog_entries_update_admin"
on public.changelog_entries for update
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

create policy "changelog_entries_delete_admin"
on public.changelog_entries for delete
to authenticated
using ( public.is_admin(auth.uid()) );
