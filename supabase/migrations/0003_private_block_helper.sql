-- Keep the block-check helper outside Supabase's exposed public API schema.
-- RLS policies can call it, but clients must not be able to query block relationships
-- through the public RPC endpoint.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_blocked_pair(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = first_user and b.blocked_id = second_user)
       or (b.blocker_id = second_user and b.blocked_id = first_user)
  );
$function$;

revoke all on function private.is_blocked_pair(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_blocked_pair(uuid, uuid) to authenticated;

drop policy if exists "profiles_read_visible" on public.profiles;
create policy "profiles_read_visible"
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or not private.is_blocked_pair(user_id, (select auth.uid()))
);

drop policy if exists "conversations_read_members" on public.conversations;
create policy "conversations_read_members"
on public.conversations for select to authenticated
using (
  (user_one = (select auth.uid()) or user_two = (select auth.uid()))
  and not private.is_blocked_pair(user_one, user_two)
);

drop policy if exists "conversations_create_member" on public.conversations;
create policy "conversations_create_member"
on public.conversations for insert to authenticated
with check (
  (user_one = (select auth.uid()) or user_two = (select auth.uid()))
  and exists (
    select 1 from public.profiles p
    where p.user_id = case when user_one = (select auth.uid()) then user_two else user_one end
  )
  and not private.is_blocked_pair(user_one, user_two)
);

drop policy if exists "messages_read_members" on public.messages;
create policy "messages_read_members"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and ((c.user_one = (select auth.uid()) and c.user_two = sender_id)
        or (c.user_two = (select auth.uid()) and c.user_one = sender_id)
        or sender_id = (select auth.uid()))
      and not private.is_blocked_pair(c.user_one, c.user_two)
  )
);

drop policy if exists "messages_send_as_member" on public.messages;
create policy "messages_send_as_member"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_one = (select auth.uid()) or c.user_two = (select auth.uid()))
      and not private.is_blocked_pair(c.user_one, c.user_two)
  )
);

drop function if exists public.is_blocked_pair(uuid, uuid);

commit;
