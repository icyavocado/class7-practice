#!/usr/bin/env node
/* tools/build-votes.mjs — aggregates community question reports from GitHub
   issues into votes.json, which the app reads for a small social-signal chip.

   Counts issue-form question reports (label: question-report), resolved by
   the 👍 (good) / 👎 (bad) reactions on the issue body.

   Env: REPO (owner/name), GITHUB_TOKEN. Writes votes.json + a human summary. */
import { writeFileSync } from 'node:fs';

const repo = process.env.REPO;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) { console.error('REPO and GITHUB_TOKEN required'); process.exit(1); }
const H = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'content-type': 'application/json',
  'user-agent': 'vote-aggregator',
};
const graphql = async (query, variables = {}) => {
  const r = await fetch(`https://api.github.com/graphql`, { method: 'POST', headers: H, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
};
const Q = `query($cursor: String) {
  repository(owner: "icyavocado", name: "class7-practice") {
    label(name: "question-report") {
      issues(first: 100, after: $cursor, states: [OPEN, CLOSED]) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number state
          reactionGroups { content reactors { totalCount } }
          comments(first: 1) { nodes { bodyText } }
        }
      }
    }
  }
}`;
const GOOD = 'THUMBS_UP', BAD = 'THUMBS_DOWN';

const votes = {};
let cursor = undefined, scanned = 0;
for (;;) {
  const data = await graphql(Q, { cursor });
  const conn = data.repository.label;
  if (!conn) break;
  for (const n of conn.issues.nodes) {
    scanned++;
    const qid = (n.comments.nodes[0]?.bodyText.match(/question id[:\s]*\S*(ch[\w-]+)/i)
      || [])[1] || (n.comments.nodes[0]?.bodyText.match(/ch[\w-]+/i) || [])[0];
    if (!qid || !/^ch/i.test(qid)) continue;
    const g = n.reactionGroups?.find(r => r.content === GOOD)?.reactors.totalCount || 0;
    const b = n.reactionGroups?.find(r => r.content === BAD)?.reactors.totalCount || 0;
    const v = votes[qid] || (votes[qid] = { up: 0, down: 0, reports: 0, open: 0 });
    v.up += g; v.down += b; v.reports++;
    if (n.state === 'OPEN') v.open++;
  }
  if (!conn.issues.pageInfo.hasNextPage) break;
  cursor = conn.issues.pageInfo.endCursor;
}
writeFileSync('votes.json', JSON.stringify(votes, null, 1));
writeFileSync('votes-summary.md',
  `Aggregated ${scanned} report${scanned === 1 ? '' : 's'} into votes.json — ` +
  `${Object.keys(votes).length} question${Object.keys(votes).length === 1 ? '' : 's'} with a community signal.`);
console.log(`scanned=${scanned} questions=${Object.keys(votes).length}`);
