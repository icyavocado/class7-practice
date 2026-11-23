-- ============================================================================
-- v1.3 migration: app-level issue reports
-- Paste once in: Supabase Dashboard -> SQL Editor
-- (schema.sql contains the same objects in fresh-install form)
-- ============================================================================

-- 1. One row per submitted issue ("Report an issue" button). Private: only
--    the edge function writes, nobody reads over the public API — review
--    here in the dashboard.
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

alter table public.site_reports enable row level security;
revoke all on public.site_reports from anon, authenticated;

-- 2. Review kit:
--    Recent reports, newest first:
--      select created_at, status, kind, message, diag from public.site_reports
--      order by created_at desc limit 25;
--    Mark one handled:
--      update public.site_reports set status = 'done' where id = '<uuid>';
--    Ban a spammy reporter (blocks future site + question reports):
--      insert into public.report_bans (value, kind, note)
--      values ('<device_id | ip_hash | fingerprint>', 'ip', 'spam');
