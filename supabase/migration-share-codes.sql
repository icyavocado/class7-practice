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
grant all on public.share_codes to service_role;

-- 2. Three-word code generator ('apple-orange-grape'; 200 easy words ->
--    27,000 combinations; the edge function retries on the rare collision).
drop function if exists public.share_code();
create or replace function public.share_code() returns text
language sql as $$
  with w as (select ARRAY['cat','dog','fox','owl','bear','deer','wolf','hare','lion','tiger','mouse','horse','sheep','goat','duck','dove','crow','swan','eagle','falcon','puppy','kitten','panda','koala','zebra','camel','otter','mole','toad','frog','crab','fish','shark','whale','snail','rabbit','spider','turtle','pigeon','hamster','donkey','seal','bee','ant','bat','sun','moon','star','cloud','rain','snow','wind','storm','river','ocean','lake','hill','leaf','tree','flower','grass','stone','sand','sea','sky','forest','meadow','island','beach','tide','frost','ice','fire','smoke','mist','breeze','thunder','sunset','rainbow','dawn','dusk','trail','cave','spring','rock','creek','fern','moss','pine','oak','elm','maple','cedar','willow','aspen','poppy','tulip','daisy','hazel','walnut','lily','rose','ivy','reed','palm','birch','apple','banana','grape','lemon','mango','melon','orange','peach','pear','plum','berry','olive','tomato','carrot','potato','onion','garlic','pepper','pumpkin','cucumber','cherry','kiwi','lime','fig','date','honey','bread','butter','cheese','toast','soup','pasta','rice','oats','bean','tea','coffee','cocoa','sugar','mint','basil','ginger','clove','bed','lamp','chair','table','clock','key','bell','book','cup','bowl','spoon','fork','plate','mug','pot','pan','jar','box','bag','ship','train','boat','kite','drum','harp','flute','pencil','eraser','ruler','stamp','coin','token','globe','magnet','red','blue','green','amber','azure','coral','gold','silver','violet','indigo','scarlet','crimson','white','black','brown','gray','pink'] as list)
  select list[1 + floor(random() * 200)::int] || '-'
      || list[1 + floor(random() * 200)::int] || '-'
      || list[1 + floor(random() * 200)::int]
  from w;
$$;

-- 2. Review kit:
--    Recent shares:
--      select code, size, created_at, device_id from public.share_codes
--      order by created_at desc limit 25;
--    Purge very old codes (they stop working):
--      delete from public.share_codes where created_at < now() - interval '365 days';
