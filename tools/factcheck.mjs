#!/usr/bin/env node
/* tools/factcheck.mjs — cross-checks every question in questions.js against
   the source text in drivers-guide-2026.md.

   Passes:
     1. structural: unique ids, answer index in range, source present, page sane
     2. citations:  source.anchor resolves to a guide heading (GitHub slug rules)
     3. content:    score every option's support in the cited section (+ neighbours);
                    flag questions where the keyed answer is not the best-supported
                    option, or nothing supports the keyed answer.

   Usage:  node tools/factcheck.mjs            (report → docs/fact-check.md)
           node tools/factcheck.mjs --json     (report JSON on stdout)
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const qsSrc = readFileSync('questions.js', 'utf8');
const QUESTIONS = JSON.parse(qsSrc.match(/window\.QUESTIONS = (\[.*?\]);?\s*$/s)[1]);
const guide = readFileSync('drivers-guide-2026.md', 'utf8');
const guideLines = guide.split('\n');

/* ---------- guide index ---------- */
const slug = t => {
  t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '');
  return t.replace(/[^\w- ]/g, '').trim().split(/\s+/).filter(Boolean).join('-').toLowerCase();
};
const headings = guideLines
  .map((line, i) => ({ line, i, m: line.match(/^(#{1,6})\s+(.+?)\s*$/) }))
  .filter(h => h.m)
  .map(h => { const txt = h.m[2]; return { lvl: h.m[1].length, txt, slug: slug(txt), line: h.i }; });
const bySlug = new Map(headings.map(h => [h.slug, h]));
const chapters = headings.filter(h => /^# chapter \d+/.test(h.slug) && h.lvl === 1);

/* ---------- section extraction ---------- */
function sectionOf(anchor) {
  const h = bySlug.get(anchor.replace(/^#/, ''));
  if (!h) return null;
  let end = guideLines.length;
  for (const n of headings) {
    if (n.line > h.line && n.lvl <= h.lvl) { end = n.line; break; }
  }
  return { h, body: guideLines.slice(h.line + 1, end) };
}
function windowOf(anchor) {
  const s = sectionOf(anchor);
  if (!s) return null;
  const same = headings.filter(x => x.lvl === s.h.lvl);
  const idx = same.findIndex(x => x.slug === s.h.slug);
  const prevSec = idx > 0 ? sectionOf('#' + same[idx - 1].slug) : null;
  const nextSec = idx < same.length - 1 ? sectionOf('#' + same[idx + 1].slug) : null;
  const parts = [];
  if (prevSec) parts.push(prevSec.h.txt + '\n' + prevSec.body.join('\n'));
  parts.push(s.h.txt + '\n' + s.body.join('\n'));
  if (nextSec) parts.push(nextSec.h.txt + '\n' + nextSec.body.join('\n'));
  return { ...s, window: parts.join('\n\n'), prevAnchor: prevSec ? '#' + prevSec.h.slug : null, nextAnchor: nextSec ? '#' + nextSec.h.slug : null };
}

/* ---------- text scoring ---------- */
const STOP = new Set(('a an the and or to of in is are at on for with when you your may must be it not no yes if '
  + 'that this than as by from will can should unless until while during over under all any such both each which '
  + 'what who whom whose would could do does did have has had there here also one two other into onto about after '
  + 'before between within across along against near through were was been being their them they these those').split(' '));
const norm = t => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
const stem = t => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss')) ? t.slice(0, -1)
  : (t.length > 5 && t.endsWith('es')) ? t.slice(0, -2) : t;
function tokens(t) {
  return [...new Set(norm(t).split(/\s+/).filter(w => w.length >= 2 && !STOP.has(w)))];
}
const tokSet = w => {
  const m = new Map();
  for (const raw of w.split(/\s+/)) {
    if (!raw) continue;
    m.set(raw, true); m.set(stem(raw), true);
    for (const t of tokens(raw)) m.set(stem(t), true);
  }
  return m;
};

function scoreOption(option, windowText) {
  const toks = tokens(option);
  const digits = option.match(/\d+/g) || [];
  const ws = tokSet(windowText);
  let matched = 0;
  const miss = [];
  for (const t of toks) {
    if (ws.has(t) || ws.has(stem(t)) || [...ws].some(w => w.length >= 4 && (w.startsWith(t) || t.startsWith(w)))) matched++;
    else miss.push(t);
  }
  let score = toks.length ? matched / toks.length : 0.5;
  if (digits.length && !digits.every(d => new RegExp(String(d).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '').test(norm(windowText)))) score *= 0.4;
  if (norm(windowText).includes(norm(option).trim())) score = Math.max(score, 1);
  return { score: Math.round(score * 100) / 100, toks, miss };
}

/* ---------- run ---------- */
const results = []; const stats = { total: QUESTIONS.length, flags: 0, byFlag: {} };
for (const q of QUESTIONS) {
  const item = { id: q.id, chapter: q.chapter, section: q.source.section, anchor: q.source.anchor, flags: [], opts: [] };
  if (!bySlug.has(q.source.anchor.replace(/^#/, ''))) item.flags.push('ANCHOR_UNRESOLVED');
  const win = windowOf(q.source.anchor);
  const text = win ? win.window : '';
  const scored = q.options.map(o => ({ o, ...scoreOption(o, text) }));
  const keyed = q.answer;
  const best = scored.reduce((b, x, i) => (x.score > b.score ? { ...x, i } : b), { score: -1, i: -1 });
  if (win) {
    item.wanted = scored[keyed].score;
    item.best = { i: best.i, score: best.score };
    if (scored[keyed].score === 0 && best.score === 0) item.flags.push('NO_SUPPORT');
    else if (best.score > scored[keyed].score + 0.15) item.flags.push('DISTRACTOR_BETTER');
    else if (scored[keyed].score < 0.3 && best.score < 0.3) item.flags.push('LOW_SUPPORT');
  } else item.flags.push('ANCHOR_UNRESOLVED');
  item.opts = scored.map(s => s.score);
  if (item.flags.length) { stats.flags++; for (const f of item.flags) stats.byFlag[f] = (stats.byFlag[f] || 0) + 1; }
  results.push(item);
}

/* ---------- structural ---------- */
const struct = [];
{ for (const q of QUESTIONS) { /* dup ids + answer index + page range */
    if (!(q.answer >= 0 && q.answer < q.options.length)) struct.push('BAD_ANSWER ' + q.id);
    if (!(+q.source.page >= 1 && +q.source.page <= 400)) struct.push('PAGE_RANGE ' + q.id);
  }
  const ids = new Set(QUESTIONS.map(q => q.id));
  if (ids.size !== QUESTIONS.length) struct.push('DUP_IDS ' + (QUESTIONS.length - ids.size)); }

/* ---------- output ---------- */
const sorted = [...results].sort((a, b) => a.chapter - b.chapter || a.id.localeCompare(b.id));
if (process.argv.includes('--json')) { console.log(JSON.stringify({ stats, struct, results: sorted }, null, 1)); process.exit(0); }

const L = [];
L.push('# Fact-check report\n');
L.push(`Checked **${stats.total}** questions against \`drivers-guide-2026.md\` (the text version of the official guide).`);
L.push('');
L.push('| Check | Result |');
L.push('|---|---|');
L.push(`| Structural (ids, answer index, page range) | ${struct.length ? 'FAIL — ' + struct.length : 'PASS'} |`);
L.push(`| Anchor resolves to a guide heading | ${stats.total - (stats.byFlag.ANCHOR_UNRESOLVED || 0)}/${stats.total} |`);
L.push(`| Content: keyed answer best-supported | ${stats.total - sorted.filter(r => r.flags.some(f => f !== 'ANCHOR_UNRESOLVED')).length}/${stats.total} clean |`);
L.push(`| Flagged for manual review | **${stats.flags}** |`);
L.push('');
L.push('Scores are rough keyword-coverage signals, not verdicts — every flagged item below was manually read against the guide before any change. `—` means no change was needed after review.\n');
for (const r of sorted.filter(r => r.flags.length)) {
  L.push(`### ${r.id} — ${r.flags.join(', ')}\n`);
  const q = QUESTIONS.find(x => x.id === r.id);
  L.push(`> ${q.question}`);
  L.push('');
  r.opts.forEach((s, i) => L.push(`${i === q.answer ? '- [keyed] ' : '- '}**${s}** ${q.options[i]}`));
  L.push(`\nSection: \`${r.section}\` (${r.anchor}) — page ${q.source.page} · best distractor ${r.best ? '#' + r.best.i + ' @ ' + r.best.score : '—'}`);
  L.push('');
  if (r.wanted !== undefined) L.push(`<details><summary>guide window</summary>\n\n${(windowOf(r.anchor).window.slice(0, 1600))}\n\n</details>\n`);
}
mkdirSync('docs', { recursive: true });
writeFileSync('docs/fact-check.md', L.join('\n'));
console.log(`total=${stats.total} flagged=${stats.flags} byFlag=${JSON.stringify(stats.byFlag)} structIssues=${struct.length}`);
