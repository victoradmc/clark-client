-- Ticket 10: the Account's chosen UI language, set from the Profile screen.
-- No new RLS policy needed — profiles_update_own_or_admin (initial schema)
-- already lets an Account update any column on its own row, same as it
-- already does for name/email/bio.

alter table public.profiles
  add column locale text not null default 'en' check (locale in ('en', 'pt-BR'));
