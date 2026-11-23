-- ============================================================================
-- v1.3 migration: cloud share codes
-- Paste once in: Supabase Dashboard -> SQL Editor
-- (schema.sql contains the same objects in fresh-install form)
-- ============================================================================

-- 1. Progress payloads behind short share codes (#p3<code>). The payload is
--    the same binary progress blob the offline link encodes (deflate-raw,
--    base64url); it carries question tiers, flags and streaks only.
create table if not exists public.share_codes (
  code       text primary key,
  payload    text not null,
  size       int  not null,
  created_at timestamptz not null default now(),
  device_id  text not null,
  ip_hash    text not null
);
create index if not exists share_codes_created_idx on public.share_codes (created_at);
create index if not exists share_codes_ip_idx      on public.share_codes (ip_hash);

alter table public.share_codes enable row level security;
revoke all on public.share_codes from anon, authenticated;

-- 2. Three-word code generator ('apple-orange-grape'; 30 easy words ->
--    27,000 combinations; the edge function retries on the rare collision).
drop function if exists public.share_code();
create or replace function public.share_code() returns text
language sql as $$
  with w as (select ARRAY['apple','banana','cherry','grape','lemon','mango','melon','orange','peach','pear','plum','berry','olive','tomato','carrot','potato','onion','garlic','pepper','pumpkin','cucumber','maple','cedar','poppy','tulip','daisy','hazel','walnut','willow','aspen'] as list)
  select list[1 + floor(random() * 30)::int] || '-'
      || list[1 + floor(random() * 30)::int] || '-'
      || list[1 + floor(random() * 30)::int]
  from w;
$$;

-- 2. Review kit:
--    Recent shares:
--      select code, size, created_at, device_id from public.share_codes
--      order by created_at desc limit 25;
--    Purge very old codes (they stop working):
--      delete from public.share_codes where created_at < now() - interval '365 days';
