-- ============================================================================
-- question_reports — community question voting with abuse accounting
-- Run this whole file once in: Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Per-vote records (one row per device per question; re-voting updates).
--    ip_hash = salted SHA-256 of the caller IP (identifies repeat offenders
--    without storing raw addresses); user_agent helps spot scripted clients.
create table if not exists public.question_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  bank_id     text not null default 'default',
  qid         text not null,
  vote        text not null check (vote in ('up','down')),
  device_id   text not null,
  ip_hash     text not null,
  fingerprint text not null default '',
  user_agent  text,
  reason      text,
  unique (bank_id, qid, device_id)
);
alter table public.question_reports add column if not exists reason text;
create index if not exists question_reports_qid_idx     on public.question_reports (bank_id, qid);
create index if not exists question_reports_device_idx  on public.question_reports (device_id);
create index if not exists question_reports_ip_idx      on public.question_reports (ip_hash);
create index if not exists question_reports_fp_idx      on public.question_reports (fingerprint);
create index if not exists question_reports_created_idx on public.question_reports (created_at);

-- 2. Banlist: a value here blocks that reporter instantly (edge function checks
--    it on every vote) and the signal view stops counting their rows.
--    kind = 'device' (device_id) | 'ip' (ip_hash) | 'fp' (fingerprint).
create table if not exists public.report_bans (
  value      text primary key,
  kind       text not null check (kind in ('device','ip','fp')),
  note       text,
  created_at timestamptz not null default now()
);

-- 3. Rate-limit / abuse log (per hashed IP, pruned by the edge function).
create table if not exists public.report_log (
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists report_log_ip_idx on public.report_log (ip_hash, created_at);

-- 4. First-time answer counts: one row per device per question; the signal
--    view counts distinct devices. The app pings this once per answer only.
create table if not exists public.question_answers (
  bank_id    text not null default 'default',
  qid        text not null,
  device_id  text not null,
  ip_hash    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_id, qid, device_id)
);
create index if not exists question_answers_qid_idx on public.question_answers (bank_id, qid);
create index if not exists question_answers_ip_idx  on public.question_answers (ip_hash);

-- 4b. Public read: aggregate counts only; banned reporters don't count.
--     answers = distinct devices that answered, reports excluded from the count.
drop view if exists public.question_signal;
create view public.question_signal as
  with v as (
    select r.bank_id, r.qid,
           count(*) filter (where r.vote = 'up')   as up,
           count(*) filter (where r.vote = 'down') as down
    from public.question_reports r
    where not exists (
      select 1 from public.report_bans b
      where b.value in (r.device_id, r.ip_hash, r.fingerprint)
    )
    group by r.bank_id, r.qid
  ),
  a as (
    select x.bank_id, x.qid, count(distinct x.device_id) as answers
    from public.question_answers x
    where not exists (
      select 1 from public.report_bans b
      where b.value in (x.device_id, x.ip_hash)
    )
    group by x.bank_id, x.qid
  )
  select coalesce(v.bank_id, a.bank_id) as bank_id,
         coalesce(v.qid, a.qid) as qid,
         coalesce(v.up, 0) as up,
         coalesce(v.down, 0) as down,
         coalesce(a.answers, 0) as answers
  from v full outer join a on a.bank_id = v.bank_id and a.qid = v.qid;

-- 5. Upserts used by the edge function (service role only; anon is not granted).
--    reason may arrive with the vote or later (reason panel Send posts a
--    second 'down' that only attaches the text).
drop function if exists public.apply_report_vote(text, text, text, text, text, text, text);
create or replace function public.apply_report_vote(
  p_bank text, p_qid text, p_vote text, p_device text, p_ip_hash text, p_fp text, p_ua text, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_reports (bank_id, qid, vote, device_id, ip_hash, user_agent, fingerprint, reason)
    values (p_bank, p_qid, p_vote, p_device, p_ip_hash, p_ua, p_fp, p_reason)
    on conflict (bank_id, qid, device_id)
    do update set vote = excluded.vote, created_at = now(), user_agent = excluded.user_agent,
                  reason = coalesce(excluded.reason, public.question_reports.reason);
end $$;

-- 5b. Answer-count ping upsert (idempotent; one row per device + question).
drop function if exists public.apply_report_ping(text, text, text, text);
create or replace function public.apply_report_ping(
  p_bank text, p_qid text, p_device text, p_ip_hash text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_answers (bank_id, qid, device_id, ip_hash)
    values (p_bank, p_qid, p_device, p_ip_hash)
    on conflict (bank_id, qid, device_id) do update set updated_at = now();
end $$;

-- 6. App-level issue reports ("Report an issue" button). Private: written
--    only by the site-report edge function, read in the dashboard. The diag
--    jsonb carries the optional app-state snapshot (route, steps, errors).
create table if not exists public.site_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  status      text not null default 'new',
  kind        text not null check (kind in ('bug','content','suggestion','other')),
  message     text not null,
  diag        jsonb,
  device_id   text not null,
  ip_hash     text not null,
  fingerprint text not null default '',
  user_agent  text
);
create index if not exists site_reports_created_idx on public.site_reports (created_at);
create index if not exists site_reports_status_idx  on public.site_reports (status);

-- 6c. Word code generator: 200 easy words -> 'apple-orange-grape' style
--     codes for cloud share links (call via the share-progress function).
create or replace function public.share_code() returns text
language sql as $$
  with w as (select ARRAY['cat','dog','fox','owl','bear','deer','wolf','hare','lion','tiger','mouse','horse','sheep','goat','duck','dove','crow','swan','eagle','falcon','puppy','kitten','panda','koala','zebra','camel','otter','mole','toad','frog','crab','fish','shark','whale','snail','rabbit','spider','turtle','pigeon','hamster','donkey','seal','bee','ant','bat','sun','moon','star','cloud','rain','snow','wind','storm','river','ocean','lake','hill','leaf','tree','flower','grass','stone','sand','sea','sky','forest','meadow','island','beach','tide','frost','ice','fire','smoke','mist','breeze','thunder','sunset','rainbow','dawn','dusk','trail','cave','spring','rock','creek','fern','moss','pine','oak','elm','maple','cedar','willow','aspen','poppy','tulip','daisy','hazel','walnut','lily','rose','ivy','reed','palm','birch','apple','banana','grape','lemon','mango','melon','orange','peach','pear','plum','berry','olive','tomato','carrot','potato','onion','garlic','pepper','pumpkin','cucumber','cherry','kiwi','lime','fig','date','honey','bread','butter','cheese','toast','soup','pasta','rice','oats','bean','tea','coffee','cocoa','sugar','mint','basil','ginger','clove','bed','lamp','chair','table','clock','key','bell','book','cup','bowl','spoon','fork','plate','mug','pot','pan','jar','box','bag','ship','train','boat','kite','drum','harp','flute','pencil','eraser','ruler','stamp','coin','token','globe','magnet','red','blue','green','amber','azure','coral','gold','silver','violet','indigo','scarlet','crimson','white','black','brown','gray','pink'] as list)
  select list[1 + floor(random() * 200)::int] || '-'
      || list[1 + floor(random() * 200)::int] || '-'
      || list[1 + floor(random() * 200)::int]
  from w;
$$;

-- 6b. Cloud share codes: progress payloads behind short #p3 word codes
--     ('apple-orange-grape'). Written only by the share-progress edge
--     function; carries tiers/flags/streaks (the same blob as the offline
--     #p2 link, deflated).
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

-- 7. Lock down: no direct anon access to any table. Reads via the view only,
--    writes via the edge function's service-role key.
alter table public.question_reports enable row level security;
alter table public.report_bans      enable row level security;
alter table public.report_log       enable row level security;
alter table public.question_answers enable row level security;
revoke all on public.question_reports from anon, authenticated;
revoke all on public.report_bans      from anon, authenticated;
revoke all on public.report_log       from anon, authenticated;
revoke all on public.question_answers from anon, authenticated;
alter table public.site_reports     enable row level security;
revoke all on public.site_reports     from anon, authenticated;
alter table public.share_codes     enable row level security;
revoke all on public.share_codes     from anon, authenticated;
grant all on public.share_codes to service_role;
grant select on public.question_signal to anon, authenticated;

-- ============================================================================
-- 8. Moderation kit (paste the snippet you need in the SQL editor).
-- ============================================================================

-- Top reporters, last 24h (same query for device_id or fingerprint):
--   select ip_hash, count(*) from public.question_reports
--   where created_at > now() - interval '24 hours'
--   group by ip_hash order by count(*) desc limit 10;

-- Multi-device voting from one IP (fingerprint mismatch check):
--   select ip_hash, count(distinct fingerprint) as devices, count(*) as votes
--   from public.question_reports
--   where created_at > now() - interval '24 hours'
--   group by ip_hash having count(distinct fingerprint) >= 4
--   order by votes desc;

-- Ban a reporter (blocks future votes immediately):
--   insert into public.report_bans (value, kind, note)
--   values ('<device_id | ip_hash | fingerprint>', 'ip', 'spam 2026-11-23');

-- Remove all reports from a banned reporter:
--   delete from public.question_reports
--   where device_id = '<value>' or ip_hash = '<value>' or fingerprint = '<value>';

-- Recent cloud share codes (purge old ones to keep the table tidy):
--   select code, size, created_at, device_id from public.share_codes
--   order by created_at desc limit 25;
--   delete from public.share_codes where created_at < now() - interval '365 days';

-- Recent site-issue reports, newest first:
--   select created_at, status, kind, message, diag from public.site_reports
--   order by created_at desc limit 25;

-- Mark a site report handled:
--   update public.site_reports set status = 'done' where id = '<uuid>';

-- Purge by question id + time window:
--   delete from public.question_reports
--   where qid = '<qid>' and created_at > now() - interval '1 hour';
