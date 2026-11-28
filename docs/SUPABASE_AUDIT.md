# بررسی وضعیت Supabase وصال

این دستور فقط فرادادهٔ ساختار پایگاه داده را می‌خواند؛ هیچ جدول، حساب، پیام یا داده‌ای را تغییر نمی‌دهد و اطلاعات شخصی کاربران را نمایش نمی‌دهد.

## چرا این بررسی لازم است؟

در گفت‌وگوی ۱۸ نوامبر ۲۰۲۶، اجرای اسکریپت اولیهٔ وصال در SQL Editor با پیام دقیق «Success No rows returned» گزارش شد. بنابراین نباید فرض کنیم پروژه Supabase وجود ندارد یا مهاجرت 0001 هنوز اجرا نشده است. در عین حال، اجرای مهاجرت‌های 0002 تا 0004 در گفتگو تأیید نشده و از اینجا نیز دسترسی مستقیم به پروژه نداریم.

## دستور بررسی فقط‌خواندنی

این کل دستور را یک‌جا در Supabase → SQL Editor اجرا کن:

```sql
with items as (
  select
    'tables'::text as section,
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity
    ) as details
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname in ('public', 'private')
    and c.relname in (
      'profiles',
      'private_user_data',
      'user_blocks',
      'conversations',
      'messages',
      'user_reports'
    )

  union all

  select
    'policies',
    jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'policy', policyname,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    )
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'private_user_data',
      'user_blocks',
      'conversations',
      'messages',
      'user_reports'
    )

  union all

  select
    'triggers',
    jsonb_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'trigger', t.tgname,
      'definition', pg_catalog.pg_get_triggerdef(t.oid)
    )
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (
      (n.nspname = 'public' and c.relname in ('profiles', 'private_user_data'))
      or (n.nspname = 'auth' and c.relname = 'users')
    )

  union all

  select
    'functions',
    jsonb_build_object(
      'schema', n.nspname,
      'function', p.proname,
      'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where p.proname in ('validate_birth_date', 'handle_new_visal_user', 'is_blocked_pair')

  union all

  select
    'schemas',
    jsonb_build_object('schema', nspname)
  from pg_catalog.pg_namespace
  where nspname = 'private'
)
select section, details
from items
order by section, details::text;
```

## تفسیر نتیجه

- باید شش جدول اصلی در schema عمومی دیده شوند و برای همهٔ آن‌ها `rls_enabled = true` باشد.
- وجود trigger با نام `on_auth_user_created_visal` روی `auth.users` نشان می‌دهد مهاجرت 0002 اجرا شده است.
- تابع `private.is_blocked_pair` باید وجود داشته باشد و تابع `public.is_blocked_pair` نباید وجود داشته باشد؛ این وضعیت نشان‌دهندهٔ اجرای اصلاح امنیتی 0003 است.
- در جدول `private_user_data` نباید سیاست `private_data_update_own` باقی مانده باشد؛ حذف آن در مهاجرت 0004 انجام می‌شود.
- trigger اعتبارسنجی تاریخ تولد باید روی `private_user_data` وجود داشته باشد. این trigger شرط سنی اعلام‌شده را در پایگاه داده کنترل می‌کند، اما هویت واقعی یا سن واقعی فرد را اثبات نمی‌کند.

## ترتیب ادامهٔ کار

با توجه به نتیجهٔ گزارش‌شدهٔ ۱۸ نوامبر، مهاجرت 0001 را بی‌دلیل دوباره اجرا نکن. ابتدا همین بررسی را انجام بده؛ سپس فقط مهاجرت‌های تأییدنشده را به ترتیب زیر اجرا کن:

1. `supabase/migrations/0002_signup_profile_trigger.sql`
2. `supabase/migrations/0003_private_block_helper.sql`
3. `supabase/migrations/0004_lock_birth_date.sql`

اگر بررسی نشان داد یکی از این تغییرها از قبل اعمال شده، آن را دوباره اجرا نکن. نتیجهٔ جدول‌های خروجی برای بازبینی کافی است؛ هیچ کلید محرمانه یا اطلاعات حساب کاربری لازم نیست.

## محدودیت

این بررسی از راه دور اجرا نشده است. اجرای آن باید در پروژهٔ Supabase مالک انجام شود تا وضعیت واقعی پروژه تأیید شود.
