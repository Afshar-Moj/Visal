-- Visal initial PostgreSQL schema for Supabase.
-- Public profile data is separated from private date-of-birth data.
-- Apply through the Supabase SQL editor or the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  city text not null check (char_length(trim(city)) between 1 and 80),
  gender text check (gender is null or gender in ('woman', 'man', 'other', 'prefer_not_to_say')),
  bio text not null default '' check (char_length(bio) <= 500),
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Date of birth is private and is never exposed through the public profile table.
create table if not exists public.private_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  created_at timestamptz not null default now(),
  constraint birth_date_is_adult check (
    birth_date <= (current_date - interval '18 years')::date
    and birth_date >= date '1900-01-01'
  )
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint cannot_block_self check (blocker_id <> blocked_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references auth.users(id) on delete cascade,
  user_two uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint distinct_conversation_users check (user_one <> user_two),
  constraint canonical_conversation_pair check (user_one < user_two),
  unique (user_one, user_two)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'fake_profile', 'underage_safety', 'inappropriate_content', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  created_at timestamptz not null default now(),
  constraint cannot_report_self check (reporter_id <> reported_user_id)
);

create index if not exists reports_created_at_idx on public.user_reports (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.private_user_data enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_reports enable row level security;

-- Authenticated users can discover profiles, except users who have blocked
-- them or whom they have blocked. Profile owners can always see their own row.
drop policy if exists "profiles_read_visible" on public.profiles;
create policy "profiles_read_visible"
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = user_id and b.blocked_id = (select auth.uid()))
       or (b.blocker_id = (select auth.uid()) and b.blocked_id = user_id)
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "private_data_read_own" on public.private_user_data;
create policy "private_data_read_own"
on public.private_user_data for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "private_data_insert_own" on public.private_user_data;
create policy "private_data_insert_own"
on public.private_user_data for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "private_data_update_own" on public.private_user_data;
create policy "private_data_update_own"
on public.private_user_data for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "blocks_read_own" on public.user_blocks;
create policy "blocks_read_own"
on public.user_blocks for select to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "blocks_insert_own" on public.user_blocks;
create policy "blocks_insert_own"
on public.user_blocks for insert to authenticated
with check (blocker_id = (select auth.uid()));

drop policy if exists "blocks_delete_own" on public.user_blocks;
create policy "blocks_delete_own"
on public.user_blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "conversations_read_members" on public.conversations;
create policy "conversations_read_members"
on public.conversations for select to authenticated
using (
  (user_one = (select auth.uid()) or user_two = (select auth.uid()))
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = user_one and b.blocked_id = user_two)
       or (b.blocker_id = user_two and b.blocked_id = user_one)
  )
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
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = user_one and b.blocked_id = user_two)
       or (b.blocker_id = user_two and b.blocked_id = user_one)
  )
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
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = c.user_one and b.blocked_id = c.user_two)
           or (b.blocker_id = c.user_two and b.blocked_id = c.user_one)
      )
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
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = c.user_one and b.blocked_id = c.user_two)
           or (b.blocker_id = c.user_two and b.blocked_id = c.user_one)
      )
  )
);

drop policy if exists "reports_submit_own" on public.user_reports;
create policy "reports_submit_own"
on public.user_reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

drop policy if exists "reports_read_own" on public.user_reports;
create policy "reports_read_own"
on public.user_reports for select to authenticated
using (reporter_id = (select auth.uid()));

-- Deliberately no client-side policies for deleting messages/reports,
-- reading another person's date of birth, or changing moderation status.
-- Moderation workflows must run through a trusted server-side admin role.
