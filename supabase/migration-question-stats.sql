-- ============================================================================
-- v1.4 migration: per-question outcome stats
-- Paste once in: Supabase Dashboard -> SQL Editor
-- (schema.sql contains the same objects in fresh-install form)
-- ============================================================================

-- 1. Aggregated right/wrong + option-pick counters per question. Written only
--    by the bump_question_stats RPC (service role) — no per-user answer
--    history is stored anywhere, so the rows cannot be de-anonymized.
create table if not exists public.question_stats (
  bank_id  text not null default 'default',
  qid      text not null,
  correct  bigint not null default 0,
  wrong    bigint not null default 0,
  picked0  bigint not null default 0,
  picked1  bigint not null default 0,
  picked2  bigint not null default 0,
  picked3  bigint not null default 0,
  unique (bank_id, qid)
);
create index if not exists question_stats_qid_idx     on public.question_stats (bank_id, qid);
create index if not exists question_stats_wrong_idx   on public.question_stats (bank_id, wrong);

alter table public.question_stats enable row level security;
revoke all on public.question_stats from anon, authenticated;
grant all on public.question_stats to service_role;

-- 2. Outcome bump: every answer (all attempts) from the report-vote function.
create or replace function public.bump_question_stats(
  p_bank text, p_qid text, p_correct boolean, p_picked smallint
) returns void
language plpgsql security definer set search_path = public as $$
declare inc int := case when p_picked between 0 and 3 then 1 else 0 end;
begin
  insert into public.question_stats (bank_id, qid, correct, wrong, picked0, picked1, picked2, picked3)
    values (
      p_bank, p_qid,
      case when p_correct then 1 else 0 end,
      case when p_correct then 0 else 1 end,
      case when p_picked = 0 then inc else 0 end,
      case when p_picked = 1 then inc else 0 end,
      case when p_picked = 2 then inc else 0 end,
      case when p_picked = 3 then inc else 0 end
    )
    on conflict (bank_id, qid) do update set
      correct = public.question_stats.correct + (case when p_correct then 1 else 0 end),
      wrong   = public.question_stats.wrong   + (case when p_correct then 0 else 1 end),
      picked0 = public.question_stats.picked0 + (case when p_picked = 0 then inc else 0 end),
      picked1 = public.question_stats.picked1 + (case when p_picked = 1 then inc else 0 end),
      picked2 = public.question_stats.picked2 + (case when p_picked = 2 then inc else 0 end),
      picked3 = public.question_stats.picked3 + (case when p_picked = 3 then inc else 0 end);
end $$;
grant execute on function public.bump_question_stats(text, text, boolean, smallint) to service_role;

-- 3. Signal view gains the outcome columns (joined on bank_id + qid).
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
  ),
  base as (
    select coalesce(v.bank_id, a.bank_id) as bank_id,
           coalesce(v.qid, a.qid) as qid,
           coalesce(v.up, 0) as up,
           coalesce(v.down, 0) as down,
           coalesce(a.answers, 0) as answers
    from v full outer join a on a.bank_id = v.bank_id and a.qid = v.qid
  )
  select base.bank_id, base.qid, base.up, base.down, base.answers,
         coalesce(s.correct, 0) as correct,
         coalesce(s.wrong, 0) as wrong,
         coalesce(s.picked0, 0) as picked0,
         coalesce(s.picked1, 0) as picked1,
         coalesce(s.picked2, 0) as picked2,
         coalesce(s.picked3, 0) as picked3
  from base
  left join public.question_stats s on s.bank_id = base.bank_id and s.qid = base.qid;
grant select on public.question_signal to anon, authenticated;

-- 4. Questions that need work (paste as needed):
--    High wrong-rate with a real sample:
--      select s.qid, s.correct, s.wrong,
--             round(100.0 * s.wrong / (s.correct + s.wrong)) as wrong_pct
--      from public.question_stats s
--      where s.correct + s.wrong >= 10
--      order by wrong_pct desc limit 25;
--    One wrong option dominating (mis-keyed or confusing):
--      select s.qid, s.correct, s.wrong,
--             greatest(s.picked0, s.picked1, s.picked2, s.picked3) as top_wrong
--      from public.question_stats s
--      where s.wrong > 0
--        and greatest(s.picked0, s.picked1, s.picked2, s.picked3)
--            > (s.wrong / 2 + s.correct)
--      order by top_wrong desc limit 25;
