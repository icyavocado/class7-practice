// Supabase Edge Function: site-report
// The only write path for app-level issue reports (bugs, suggestions).
// Same protections as report-vote: banlist, salted-IP fingerprint, per-IP
// rate limits; inserts one row, no upsert semantics. Reports are read from
// the SQL dashboard (they stay private — no public view).
//
// Deploy:  supabase functions deploy site-report
// Invoke:  POST https://<project>.supabase.co/functions/v1/site-report
//          { "kind": "bug", "message": "...", "device_id": "...",
//            "diag": { version, route, question, steps, ... } }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SERVICE =
  Deno.env.get('SUPABASE_SECRET_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';
const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SALT = Deno.env.get('REPORT_SALT') ?? '';
const admin = createClient(URL, SERVICE);

// issue reports are rare by hand — keep tight budgets
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;
const KINDS = ['bug', 'content', 'suggestion', 'other'];
const DIAG_MAX = 4096;          // serialized JSON cap
const MESSAGE_MIN = 4;
const MESSAGE_MAX = 2000;

const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? '').toLowerCase().slice(0, 20);
    const message = String(body.message ?? '').trim().slice(0, MESSAGE_MAX);
    const deviceId = String(body.device_id ?? '').slice(0, 64);

    // validation
    if (!KINDS.includes(kind)) return json({ error: 'invalid kind' }, 400);
    if (message.length < MESSAGE_MIN) return json({ error: 'message too short' }, 400);
    if (!deviceId || deviceId.length < 8) return json({ error: 'invalid device' }, 400);

    // optional diagnostics snapshot (client-built JSON object)
    let diag = null;
    if (body.diag !== undefined && body.diag !== null) {
      if (typeof body.diag !== 'object' || Array.isArray(body.diag)) return json({ error: 'invalid diag' }, 400);
      const flat = JSON.stringify(body.diag);
      if (flat.length > DIAG_MAX) return json({ error: 'diag too large' }, 400);
      diag = body.diag;
    }

    const ip = (req.headers.get('cf-connecting-ip') ??
      (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()) || 'unknown';
    const ipHash = await sha256(ip + SALT);
    const fingerprint = await sha256(deviceId + ipHash + SALT);
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 180);

    // banlist: reject instantly if this device, IP, or fingerprint is banned
    const { data: banned } = await admin
      .from('report_bans')
      .select('value')
      .in('value', [deviceId, ipHash, fingerprint]);
    if (banned && banned.length) return json({ error: 'banned' }, 403);

    // rate limits per hashed IP (rolling windows against the log table)
    const { count: hourCount } = await admin
      .from('report_log')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((hourCount ?? 0) >= HOURLY_LIMIT) return json({ error: 'rate limited (hourly)' }, 429);

    const { count: dayCount } = await admin
      .from('report_log')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
    if ((dayCount ?? 0) >= DAILY_LIMIT) return json({ error: 'rate limited (daily)' }, 429);

    // append to the log + prune rows older than a day (opportunistic)
    await admin.from('report_log').insert({ ip_hash: ipHash });
    await admin.from('report_log').delete().lt('created_at', new Date(Date.now() - 172_800_000).toISOString());

    await admin.from('site_reports').insert({
      kind, message, diag: diag ?? null, device_id: deviceId,
      ip_hash: ipHash, fingerprint, user_agent: ua,
    });

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err?.message ?? err).slice(0, 160) }, 500);
  }
});
