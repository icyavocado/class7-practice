// Supabase Edge Function: report-vote
// The only write path for community question reports and answer counts.
// Validates, banlist-checks, rate-limits per IP, fingerprints (salted IP),
// upserts the event, returns the fresh aggregate for that question.
//
// Deploy:  supabase functions deploy report-vote
// Secrets: supabase secrets set REPORT_SALT=<random hex>
// Invoke:  POST https://<project>.supabase.co/functions/v1/report-vote
//          { "bank_id": "default", "qid": "ch1-001", "vote": "down",
//            "device_id": "...", "reason": "Wrong answer — ..." }
//          or vote: "answered" (first-time answer ping; idempotent).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SERVICE =
  Deno.env.get('SUPABASE_SECRET_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';
const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SALT = Deno.env.get('REPORT_SALT') ?? '';
const admin = createClient(URL, SERVICE);

// limits for votes ('up' / 'down')
const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 100;
// answer pings are idempotent (one row per device + question) and only fire
// on the first answer of a question per device, so they get looser budgets
const ANSWER_HOURLY_LIMIT = 240;
const ANSWER_DAILY_LIMIT = 600;

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
    const bankId = String(body.bank_id ?? 'default').slice(0, 40);
    const qid = String(body.qid ?? '').slice(0, 40);
    const vote = String(body.vote ?? '').toLowerCase().slice(0, 10);
    const deviceId = String(body.device_id ?? '').slice(0, 64);
    const isAnswerPing = vote === 'answered';
    // optional reason attaches to the downvote (same or later POST); the
    // coalesce in the SQL means a reason-only POST never erases an earlier one
    const reason = body.reason === undefined || body.reason === null
      ? null
      : String(body.reason).trim().slice(0, 500) || null;
    const sessionToken = String(body.session_token ?? '').slice(0, 64);

    // validation
    if (!qid || !/^[a-z0-9-]{2,40}$/.test(qid)) return json({ error: 'invalid qid' }, 400);
    if (vote !== 'up' && vote !== 'down' && !isAnswerPing) return json({ error: 'invalid vote' }, 400);
    if (vote === 'up' && reason) return json({ error: 'reason only applies to downvotes' }, 400);
    if (!deviceId || deviceId.length < 8) return json({ error: 'invalid device' }, 400);
    if (bankId !== 'default' && !/^b[a-z0-9]{8,16}$/.test(bankId)) return json({ error: 'invalid bank' }, 400);

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
    const hourlyLimit = isAnswerPing ? ANSWER_HOURLY_LIMIT : HOURLY_LIMIT;
    const dailyLimit = isAnswerPing ? ANSWER_DAILY_LIMIT : DAILY_LIMIT;
    const { count: hourCount } = await admin
      .from('report_log')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((hourCount ?? 0) >= hourlyLimit) return json({ error: 'rate limited (hourly)' }, 429);

    const { count: dayCount } = await admin
      .from('report_log')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
    if ((dayCount ?? 0) >= dailyLimit) return json({ error: 'rate limited (daily)' }, 429);

    // fingerprint-mismatch watch: many different devices from one IP in 24h
    // (vote path only — a classroom sharing one IP would otherwise false-flag)
    if (!isAnswerPing) {
      const { data: recentSame } = await admin
        .from('question_reports')
        .select('fingerprint')
        .eq('ip_hash', ipHash)
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      const devicesSeen = new Set((recentSame ?? []).map((r) => r.fingerprint));
      devicesSeen.add(fingerprint);
      if (devicesSeen.size >= 6) {
        await admin.from('report_bans').upsert({
          value: ipHash, kind: 'ip',
          note: `auto-flag: ${devicesSeen.size} distinct devices from one IP in 24h`,
        });
      }
    }

    // append to the log + prune rows older than a day (opportunistic)
    await admin.from('report_log').insert({ ip_hash: ipHash });
    await admin.from('report_log').delete().lt('created_at', new Date(Date.now() - 172_800_000).toISOString());

    // persist the event (upsert per device+question)
    if (isAnswerPing) {
      await admin.rpc('apply_report_ping', {
        p_bank: bankId, p_qid: qid, p_device: deviceId, p_ip_hash: ipHash,
      });
    } else {
      await admin.rpc('apply_report_vote', {
        p_bank: bankId, p_qid: qid, p_vote: vote, p_device: deviceId,
        p_ip_hash: ipHash, p_fp: fingerprint, p_ua: ua, p_reason: reason,
      });
    }

    // fresh aggregate for this question
    const { data: signal } = await admin
      .from('question_signal')
      .select('up, down, answers')
      .eq('bank_id', bankId)
      .eq('qid', qid)
      .maybeSingle();

    return json({
      ok: true,
      up: signal?.up ?? 0,
      down: signal?.down ?? 0,
      answers: signal?.answers ?? 0,
      recorded: vote,
    });
  } catch (err) {
    return json({ error: String(err?.message ?? err).slice(0, 160) }, 500);
  }
});
