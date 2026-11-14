-- Create a profile and private birth-date record automatically for app signups.
-- The trigger runs inside the auth.users insert transaction, so an invalid
-- or incomplete registration cannot leave a partially-created account.

create or replace function public.handle_new_visal_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  selected_gender text;
begin
  if coalesce(metadata ->> 'display_name', '') = ''
     or coalesce(metadata ->> 'city', '') = ''
     or coalesce(metadata ->> 'birth_date', '') = '' then
    raise exception 'Registration details are incomplete.'
      using errcode = '23514';
  end if;

  selected_gender := nullif(metadata ->> 'gender', '');

  if selected_gender is not null
     and selected_gender not in ('woman', 'man', 'other', 'prefer_not_to_say') then
    raise exception 'Invalid gender selection.'
      using errcode = '23514';
  end if;

  insert into public.private_user_data (user_id, birth_date)
  values (new.id, (metadata ->> 'birth_date')::date);

  insert into public.profiles (user_id, display_name, city, gender, bio)
  values (
    new.id,
    metadata ->> 'display_name',
    metadata ->> 'city',
    selected_gender,
    coalesce(metadata ->> 'bio', '')
  );

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_visal on auth.users;
create trigger on_auth_user_created_visal
after insert on auth.users
for each row
execute function public.handle_new_visal_user();
