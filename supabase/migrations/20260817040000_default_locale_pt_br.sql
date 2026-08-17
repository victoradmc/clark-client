-- pt-BR becomes the default language everywhere going forward (ticket 01,
-- clark-changelog-locale).
-- Only changes what a *new* profiles row gets when locale isn't part of the
-- insert (self-registration's trigger, Admin-direct creation's Edge
-- Function — neither sets locale explicitly). Existing rows are untouched;
-- no update statement here.

alter table public.profiles
  alter column locale set default 'pt-BR';
