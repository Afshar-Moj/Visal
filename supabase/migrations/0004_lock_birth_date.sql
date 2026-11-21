-- Prevent authenticated users from changing their date of birth after signup.
-- Birth-date corrections must go through a reviewed support process.
-- This does not prove a person's real-world age; it only freezes the self-declared value.
begin;

drop policy if exists "private_data_update_own" on public.private_user_data;

comment on table public.private_user_data is
  'Private account data. Date of birth is self-declared at signup and is not editable by authenticated clients.';

commit;
