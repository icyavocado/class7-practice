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
  unique (bank_id, qid, device_id)
);
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

-- 4. Public read: aggregate counts only; banned reporters don't count.
create or replace view public.question_signal as
  select r.bank_id, r.qid,
         count(*) filter (where r.vote = 'up')   as up,
         count(*) filter (where r.vote = 'down') as down
  from public.question_reports r
  where not exists (
    select 1 from public.report_bans b
    where b.value in (r.device_id, r.ip_hash, r.fingerprint)
  )
  group by r.bank_id, r.qid;

-- 5. Upsert used by the edge function (service role only; anon is not granted).
create or replace function public.apply_report_vote(
  p_bank text, p_qid text, p_vote text, p_device text, p_ip_hash text, p_fp text, p_ua text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_reports (bank_id, qid, vote, device_id, ip_hash, user_agent, fingerprint)
    values (p_bank, p_qid, p_vote, p_device, p_ip_hash, p_ua, p_fp)
    on conflict (bank_id, qid, device_id)
    do update set vote = excluded.vote, created_at = now(), user_agent = excluded.user_agent;
end $$;

-- 7. Lock down: no direct anon access to any table. Reads via the view only,
--    writes via the edge function's service-role key.
alter table public.question_reports enable row level security;
alter table public.report_bans      enable row level security;
alter table public.report_log       enable row level security;
revoke all on public.question_reports from anon, authenticated;
revoke all on public.report_bans      from anon, authenticated;
revoke all on public.report_log       from anon, authenticated;
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

-- Purge by question id + time window:
--   delete from public.question_reports
--   where qid = '<qid>' and created_at > now() - interval '1 hour';
