-- ============================================================================
-- v1.3 migration: answered counts + downvote reasons
-- Paste once in: Supabase Dashboard -> SQL Editor
-- (schema.sql contains the same objects in fresh-install form)
-- ============================================================================

-- 1. Why a downvote was cast (optional; the reason panel fills it in).
alter table public.question_reports add column if not exists reason text;

-- 2. First-time answer counts: one row per device per question. The app
--    pings this once per answer only; the signal view counts distinct devices.
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

-- 3. Signal view now also exposes `answers` (banned reporters don't count).
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
grant select on public.question_signal to anon, authenticated;

-- 4. Upserts used by the edge function (service role only).
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

-- 5. Lock down the new table like the others (writes only via the function).
alter table public.question_answers enable row level security;
revoke all on public.question_answers from anon, authenticated;
