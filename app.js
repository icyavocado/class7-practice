/* app.js — Alberta Class 7 Practice 2026
   One page, one viewport: topbar + question zone; chapter confidence lives in the picker pills.
   Classic script; depends on window.DB (store.js) and window.QUESTIONS (bank). */
(function () {
  'use strict';

  /* ------------------------------------------------ constants */
  const PASS_MARK = 0.80;          // configurable via meta.settings
  const EXAM_LEN = 30;
  const EXAM_MINUTES = 60;
  const CHAPTERS = [
    { id: 1,  name: 'Licensing & GDL' },
    { id: 2,  name: 'Traffic Control' },
    { id: 3,  name: 'Basics of Driving' },
    { id: 4,  name: 'Intersections & Turns' },
    { id: 5,  name: 'Highways & Freeways' },
    { id: 6,  name: 'Emergencies' },
    { id: 7,  name: 'Responsible Driving' },
    { id: 8,  name: 'Sharing the Road' },
    { id: 9,  name: 'Driving within the Law' },
    { id: 10, name: 'Towing a Trailer' },
  ];

  /* ------------------------------------------------ helpers */
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mmss = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* Modern Web Guidance: wrap DOM updates in document.startViewTransition.
     Falls back to direct rendering, and never animates under reduced motion. */
  const noMotion = matchMedia('(prefers-reduced-motion: reduce)');
  window.QUESTION_VOTES = window.QUESTION_VOTES || {};
  fetch('./votes.json').then(r => r.ok ? r.json() : null).then(v => { if (v) window.QUESTION_VOTES = v; }).catch(() => {});
  const withTransition = fn => {
    if (document.startViewTransition && !noMotion.matches) {
      // a newer view transition supersedes this one on rapid navigation; ignore the abort
      const vt = document.startViewTransition(fn);
      vt.ready.catch(() => {});
      vt.finished.catch(() => {});
    } else fn();
  };

  const S = {
    bank: [], byId: new Map(), byChapter: new Map(),
    P: new Map(),            // qid -> progress record (mirror of DB)
    sessions: [],
    settings: { passMark: PASS_MARK, examLen: EXAM_LEN, examMinutes: EXAM_MINUTES },
    view: null,              // active view object
  };

  /* ------------------------------------------------ boot */
  DB.ready().then(() => {
    S.bank = (window.QUESTIONS || []).slice();
    S.bank.forEach(q => {
      S.byId.set(q.id, q);
      if (!S.byChapter.has(q.chapter)) S.byChapter.set(q.chapter, []);
      S.byChapter.get(q.chapter).push(q);
    });
    if (DB.isFallback()) $('#dbwarn').hidden = false;
    return Promise.all([DB.getAllState(), DB.getSessions(), DB.getMeta('settings'), DB.getMeta('profiles')]);
  }).then(([states, sessions, settings, profiles]) => {
    profilesReg = (profiles && typeof profiles === 'object' && Object.keys(profiles).length) ? profiles : {};
    if (settings) Object.assign(S.settings, settings);
    // resolve the active profile: last used name, defaulting to 'Main'
    const name = S.settings.profile || 'Main';
    // migrate the anonymous-era save (the hot stores) if this profile has no entry
    if (!profilesReg[name]) {
      profilesReg[name] = { p: states || [], sessions: sessions || [], stash: null, created: Date.now() };
      DB.putMeta('profiles', profilesReg);
      if (!S.settings.profile) {
        S.settings.profile = name;
        DB.putMeta('settings', S.settings);
      }
    }
    // the hot stores hold the freshest data for the active profile
    profilesReg[name].p = states || [];
    profilesReg[name].sessions = sessions || [];
    loadProfileHot(name);
    DB.putMeta('profiles', profilesReg);
    refreshProfRow();
    applyAppearance(S.settings.appearance || localStorage.getItem('appearance') || 'system');
    const hash = location.hash.slice(1);
    if (hash.indexOf('p1') === 0) {
      decodeShareLink(hash).then(function(data) {
        S.pendingShareData = data; S.pendingShareError = null;
        if (S.view && S.view.mode === 'idle') withTransition(gotoIdle);
      }).catch(function() {
        S.pendingShareError = true; S.pendingShareData = null;
        if (S.view && S.view.mode === 'idle') withTransition(gotoIdle);
      });
    }
    withTransition(gotoIdle);
  });

  /* ------------------------------------------------ profiles */
  let profilesReg = {};
  function loadProfileHot(name) {
    const st = profilesReg[name] || { p: [], sessions: [], stash: null };
    profilesReg[name] = st;
    S.P = new Map((st.p || []).map(r => [r.qid, r]));
    S.sessions = (st.sessions || []).slice();
    S.stash = st.stash ? (typeof st.stash === 'object' ? JSON.parse(JSON.stringify(st.stash)) : null) : null;
    S.settings.profile = name;
  }
  function saveCurrentProfile() {
    if (!S.P) return;
    const name = currentProfile();
    profilesReg[name] = {
      p: [...S.P.values()].map(r => ({ ...r })),
      sessions: S.sessions.slice(),
      stash: S.stash ? JSON.parse(JSON.stringify(S.stash)) : null,
      created: (profilesReg[name] && profilesReg[name].created) || Date.now(),
    };
    if (window.DB) DB.putMeta('profiles', profilesReg);
  }
  function currentProfile() { return (S.settings && S.settings.profile) || 'Main'; }
  function switchProfile(name) {
    if (!profilesReg[name] || name === currentProfile()) return;
    const v = S.view;
    gotoIdle();                                     // collapses terminal/finished views, clears a live run's timer
    if (v && v.mode && v.mode !== 'idle' && !v.done) stashRun();   // park a live run on its own profile
    saveCurrentProfile();
    loadProfileHot(name);
    DB.putMeta('settings', S.settings);
    renderTop();
    withTransition(gotoIdle);
  }
  function refreshProfRow() {
    const pick = document.getElementById('profpick');
    if (!pick) return;
    pick.innerHTML = Object.keys(profilesReg).sort().map(function(n){
      return '<option value="' + esc(n) + '"' + (n === currentProfile() ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('');
  }

  /* progress record helpers */
  function rec(qid) {
    let r = S.P.get(qid);
    if (!r) { r = { qid, status: 'unseen', attempts: 0, reviewStreak: 0, flagged: false, lastResult: null, updatedAt: 0 }; S.P.set(qid, r); }
    return r;
  }
  function persist(qid) {
    const r = S.P.get(qid); r.updatedAt = Date.now();
    DB.putState(r);
  }

  /* confidence: known / total per chapter */
  function chapterStats(c) {
    const pool = S.byChapter.get(c) || [];
    let known = 0;
    pool.forEach(q => { const r = S.P.get(q.id); if (r && r.status === 'known') known++; });
    return { known, total: pool.length, pct: pool.length ? known / pool.length : 0 };
  }

  /* ------------------------------------------------ appearance */
  const APP_VERSION = 'v1.1';
  const RING_C = 2 * Math.PI * 19;
  function ringInit() {
    const arc = document.getElementById('ringarc');
    if (arc) arc.style.strokeDasharray = RING_C.toFixed(1);
  }
  function applyAppearance(mode) {
    mode = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
    const root = document.documentElement;
    if (mode === 'system') delete root.dataset.colorScheme;
    else root.dataset.colorScheme = mode;
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (mode !== 'system') {
      const c = mode === 'light' ? '#eef0f3' : '#0b0c0e';
      metas.forEach(m => { m.content = c; m.removeAttribute('media'); });
    } else if (metas[0] && metas[1]) {
      metas[0].content = '#eef0f3'; metas[0].setAttribute('media', '(prefers-color-scheme: light)');
      metas[1].content = '#0b0c0e'; metas[1].setAttribute('media', '(prefers-color-scheme: dark)');
    }
    try { localStorage.setItem('appearance', mode); } catch (e) {}
    const pick = document.getElementById('appearpick');
    if (pick) [...pick.querySelectorAll('button')].forEach(b => b.classList.toggle('on', b.dataset.appearance === mode));
  }
  function setAppearance(mode) {
    S.settings = S.settings || {};
    S.settings.appearance = mode;
    applyAppearance(mode);
    if (window.DB) DB.putMeta('settings', S.settings);
  }
  applyAppearance(localStorage.getItem('appearance') || 'system');   // mirror before DB load: no theme flash
  ringInit();                                                        // assert the arc's dash pattern at boot
  (function footerVersion() {                                        // footer shows the running version
    const ver = document.getElementById('verlink');
    if (ver) {
      ver.textContent = APP_VERSION;
      ver.href = 'https://github.com/icyavocado/class7-practice/releases/tag/' + APP_VERSION;
    }
  })();

  /* ------------------------------------------------ ring + run controls */
  function ringInit() {
    const arc = document.getElementById('ringarc');
    if (arc) arc.style.strokeDasharray = RING_C.toFixed(1);
  }
  function updateRing(activeRun) {
    const seen = S.bank.filter(q => { const r = S.P.get(q.id); return r && r.status !== 'unseen'; }).length;
    const total = S.bank.length;
    const nEl = document.getElementById('ringn'), totEl = document.getElementById('ringtotal'), arc = document.getElementById('ringarc');
    const ring = document.getElementById('ring');
    if (!ring) return;
    nEl.textContent = seen;
    totEl.textContent = '/' + total;
    arc.style.strokeDasharray = RING_C.toFixed(1);
    arc.style.strokeDashoffset = (RING_C * ((total ? seen / total : 0) - 1)).toFixed(1);   // negative: fill grows clockwise from 12 o'clock
    ring.classList.toggle('spinning', !!activeRun);
    ring.title = 'Questions seen: ' + seen + ' of ' + total;
    const ts = document.getElementById('testsstat');
    if (ts) ts.textContent = S.sessions.length;
  }

  /* ------------------------------------------------ settings menu */
  const gearbtn = document.getElementById('gearbtn'), settingsPanel = document.getElementById('settings');
  gearbtn.onclick = () => {
    settingsPanel.hidden = !settingsPanel.hidden;
    gearbtn.setAttribute('aria-expanded', String(!settingsPanel.hidden));
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && settingsPanel && !settingsPanel.hidden) {
      settingsPanel.hidden = true;
      gearbtn.setAttribute('aria-expanded', 'false');
    }
  });
  document.getElementById('appearpick').onclick = e => {
    const b = e.target.closest('button[data-appearance]');
    if (b) setAppearance(b.dataset.appearance);
  };

  function renderTop() {
    const activeRun = S.view && S.view.mode && S.view.mode !== 'idle' && !S.view.done;
    const compact = matchMedia('(max-width: 480px)').matches;
    const skipLbl = activeRun ? (S.view.mode === 'exam' ? (compact ? 'Skip' : 'Skip test') : (compact ? 'Skip' : 'Skip practice')) : null;
    const resumeLbl = S.stash ? (S.stash.mode === 'exam' ? (compact ? 'Resume' : 'Resume test') : (compact ? 'Resume' : 'Resume practice')) : null;
    updateRing(activeRun);
    $('#topstats').innerHTML =
      (skipLbl ? `<button class="runpill" data-act="skip">${esc(skipLbl)}</button>` : '') +
      (resumeLbl ? `<button class="runpill fill" data-act="resume">${esc(resumeLbl)}</button>` : '');
  }
  document.addEventListener('click', e => {
    const panel = document.getElementById('settings');
    if (panel && !panel.hidden && !e.target.closest('#settings') && !e.target.closest('#gearbtn')) {
      panel.hidden = true;
      document.getElementById('gearbtn').setAttribute('aria-expanded', 'false');
    }
    if (e.target.closest('#resetbtn')) { handleReset(); return; }
    if (e.target.closest('[data-act="skip"]')) { stashRun(); return; }
    if (e.target.closest('[data-act="resume"]')) { resumeRun(); return; }
    const mark = e.target.closest('#tally i');
    if (mark) {
      const v = S.view;
      if (v && v.queue) {
        const k = [...mark.parentElement.children].indexOf(mark);
        const ans = (v.tally || []).filter(x => x === true || x === false).length;
        if (v.mode === 'exam' || k < ans) gotoQuestion(k);
      }
      return;
    }
  });

  /* ------------------------------------------------ view rendering */
  /* reset: destructive — first click arms (4s), second confirms the wipe */
  let resetArmed = false, resetTimer = 0;
  function paintReset() {
    const b = $('#resetbtn'); if (!b) return;
    b.classList.toggle('armed', resetArmed);
    const compact = matchMedia('(max-width: 480px)').matches;
    b.textContent = resetArmed ? (compact ? 'Confirm erase?' : 'Confirm — erase all progress?')
      : (compact ? 'Reset' : 'Reset progress');
  }
  /* ------------------------------------------------ profiles + share/restore */
  (function initProfileRow() {
    const row = document.getElementById('profpick');
    if (!row) return;
    row.addEventListener('change', function() { switchProfile(row.value); });
    document.getElementById('profnew').onclick = function() {
      const names = Object.keys(profilesReg);
      const name = (window.prompt('Name for the new profile:', 'Player ' + (names.length + 1)) || '').trim();
      if (!name || profilesReg[name]) return;
      profilesReg[name] = { p: [], sessions: [], stash: null, created: Date.now() };
      DB.putMeta('profiles', profilesReg);
      switchProfile(name);
    };
    document.getElementById('profrn').onclick = function() {
      const name = currentProfile();
      let renamed = (window.prompt('Rename profile "' + name + '" to:', name) || '').trim();
      if (!renamed || profilesReg[renamed]) return;
      profilesReg[renamed] = profilesReg[name];
      delete profilesReg[name];
      if (currentProfile() === name) S.settings.profile = renamed;
      DB.putMeta('profiles', profilesReg);
      DB.putMeta('settings', S.settings);
      refreshProfRow();
    };
    let delArmed = false, delTimer = 0;
    document.getElementById('profdel').onclick = function() {
      const btn = document.getElementById('profdel');
      if (!delArmed) {
        delArmed = true;
        btn.textContent = 'Sure?';
        delTimer = setTimeout(function() { delArmed = false; btn.textContent = '✕'; }, 4000);
        return;
      }
      clearTimeout(delTimer); delArmed = false; btn.textContent = '✕';
      const name = currentProfile();
      const others = Object.keys(profilesReg).filter(function(n){ return n !== name; });
      if (!others.length) return;                     // always keep at least one profile
      delete profilesReg[name];
      DB.clearProgressStores().then(function() {
        S.settings.profile = others[0];
        DB.putMeta('settings', S.settings);
        const st = profilesReg[others[0]];
        S.P = new Map((st.p || []).map(function(r){ return [r.qid, r]; }));
        S.sessions = (st.sessions || []).slice();
        S.stash = st.stash ? JSON.parse(JSON.stringify(st.stash)) : null;
        DB.putMeta('profiles', profilesReg);
        refreshProfRow();
        renderTop();
        gotoIdle();
      });
    };
    refreshProfRow();
  })();

  /* ------------------------------------------------ share / restore */
  function progressPairs() {
    const out = [];
    S.bank.forEach(function(q, i) {
      const r = S.P.get(q.id); if (!r) return;
      const tier = r.status === 'known' ? 2 : (r.status === 'review' ? 1 : 0);
      const code = tier | (r.flagged ? 4 : 0) | (Math.min(r.reviewStreak || 0, 3) << 3);
      if (code !== 0) out.push([i, code]);
    });
    return out;
  }
  function deflateBytes(bytes) {
    return deflateRaw(bytes, new CompressionStream('deflate-raw'));
  }
  function inflateBytes(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const reader = ds.readable.getReader();
    const writer = ds.writable.getWriter();
    return (async function() {
      await writer.write(bytes);
      await writer.close();
      const out = [];
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        for (const b of chunk.value) out.push(b);
      }
      return new Uint8Array(out);
    })();
  }
  function deflateRaw(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function(buf) { return new Uint8Array(buf); });
  }
  function b64urlEncode(bytes) {
    let bin = '';
    bytes.forEach(function(b){ bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function packProgressBytes() {
    const bytes = [];
    progressPairs().forEach(function(pair) {
      bytes.push(pair[0] & 255, (pair[0] >> 8) & 255, pair[1] & 255);
    });
    let sum = 0; bytes.forEach(function(b){ sum += b; });
    bytes.push(sum & 255, (sum >> 8) & 255);           // 2-byte checksum
    return new Uint8Array(bytes);
  }
  async function buildShareLink() {
    return location.origin + location.pathname + '#p2' + b64urlEncode(packProgressBytes());
  }
  async function decodeShareLink(input) {
    const hash = input.replace(/^.*#/, '');
    const wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    let m = hash.match(/^p2([A-Za-z0-9_-]+)$/);
    let bytes;
    if (m) {
      bytes = rawDecodePad(m[1]);
    } else {
      m = hash.match(/^p1([zr])([A-Za-z0-9_-]+)$/);
      if (!m) throw new Error('not a share link');
      bytes = rawDecodePad(m[2]);
      if (bytes.length < 2) throw new Error('empty');
      const chk = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
      const body = bytes.slice(0, bytes.length - 2);
      let sum = 0; body.forEach(function(b){ sum += b; });
      if ((sum & 255) !== (chk & 255) || (sum >> 8) !== (chk >> 8)) throw new Error('checksum');
      if (m[1] === 'z') body = await Promise.race([ inflateBytes(body), wait(1200).then(function(){ throw new Error('decompression unsupported'); }) ]);
      bytes = body;
    }
    const out = [];
    for (let i = 0; i + 2 <= bytes.length; i += 3) out.push([bytes[i] | (bytes[i + 1] << 8), bytes[i + 2] & 31]);
    const seen = out.filter(function(p){ return (p[1] & 3) !== 0; }).length;
    const flags = out.filter(function(p){ return (p[1] & 4) === 4; }).length;
    return { pairs: out, seen: seen, review: Math.max(0, seen - out.filter(function(p){ return (p[1] & 3) === 2; }).length), flags: flags };
  }
  function rawDecodePad(b64) {
    let s = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (s.length % 4)) % 4;
    s += '='.repeat(pad);
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function applyImportPairs(pairs) {
    pairs.forEach(function(pair) {
      const q = S.bank[pair[0]]; if (!q) return;
      const tier = pair[1] & 3, flag = (pair[1] & 4) === 4, streak = (pair[1] >> 3) & 3;
      const r = rec(q.id);
      if (r.status === 'unseen') {
        r.status = tier === 2 ? 'known' : (tier === 1 ? 'review' : 'unseen');
        r.reviewStreak = streak;
      }
      if (flag) r.flagged = true;
      persist(q.id);
    });
    bulkPersist();
    saveCurrentProfile();
    renderTop();
  }
  function bulkPersist() {
    if (window.DB && DB.bulkPutState) DB.bulkPutState([...S.P.values()]);
  }
  function clearPendingShare() {
    history.replaceState(null, '', location.pathname + location.search);
    S.pendingShareData = null; S.pendingShareError = null;
  }
  window.__share = { buildShareLink: buildShareLink, decodeShareLink: decodeShareLink, packProgressBytes: packProgressBytes, deflateBytes: deflateBytes, inflateBytes: inflateBytes };

  function handleReset() {
    if (!resetArmed) {
      resetArmed = true; paintReset();
      resetTimer = setTimeout(() => { resetArmed = false; paintReset(); }, 4000);
      return;
    }
    clearTimeout(resetTimer); resetArmed = false;
    const name = currentProfile();                     // reset wipes only the active profile
    DB.clearProgressStores().then(() => {
      profilesReg[name] = { p: [], sessions: [], stash: null, created: Date.now() };
      DB.putMeta('profiles', profilesReg);
      S.P.clear(); S.sessions = []; S.stash = null;
      gotoIdle();
    });
  }

  function zone(html) { $('#zone').innerHTML = html; }

  function gotoIdle() {
    if (S.view && S.view.timer) clearInterval(S.view.timer);
    S.view = { mode: 'idle' }; document.title = 'Alberta Class 7 Practice 2026';
    renderTop();
    const weakCh = weakestChapter();
    const reviewCount = countReview();
    let shareBody = '', impBtn = '';
    if (S.pendingShareError) {
      shareBody = '<div class="muted">Could not read that link — ask to share it again.</div>';
    } else if (S.pendingShareData) {
      shareBody = '<div class="muted">' + S.pendingShareData.seen + ' seen · ' + S.pendingShareData.review + ' review · ' + S.pendingShareData.flags + ' flags — importing fills unanswered questions.</div>';
      impBtn = '<button class="runpill fill" id="impshare">Import progress</button>';
    }
    const banner = (S.pendingShareData || S.pendingShareError) ? `<div class="sharebanner">
        <div class="sbtitle">Shared progress detected</div>
        ${shareBody}
        <div class="shareacts">${impBtn}<button class="setbtn" id="ignshare">Ignore</button></div>
      </div>` : '';
    zone(`<section class="card wrap idle" aria-label="Overview">
      ${banner}
      <div class="modegrid">
        <button class="modecard" id="m-exam"><b>Exam simulation</b><span class="desc">${S.settings.examLen} random questions, ${S.settings.examMinutes} minute soft timer, pass at ${Math.round(S.settings.passMark * 100)}%.</span></button>
        <button class="modecard" id="m-ch"><b>Chapter test</b><span class="desc">Instant feedback with explanations and guide citations.</span></button>
        <button class="modecard" id="m-review" ${reviewCount ? '' : 'disabled'}><b>Review (${reviewCount})</b><span class="desc">Repeated practice on missed and flagged questions.</span></button>
      </div>
      <div class="muted" style="margin-bottom:2px">Pick a chapter to practice:</div>
      <div id="chapters">${CHAPTERS.map(c => {
        const st = chapterStats(c.id);
        const cls = !st.total ? '' : (st.pct === 1 ? 'ok' : (st.pct < 0.4 ? 'weak' : (st.pct < 0.7 ? 'warn' : '')));
        const label = st.total ? Math.round(st.pct * 100) + '%' : '—';
        const isWeak = weakCh && c.id === weakCh.id;
        return `<button data-chapter="${c.id}"${isWeak ? ` class="isweak" title="Lowest confidence here — a good next step"` : ''}><span>${esc(c.name)}</span><span class="pctp ${cls}">${label}</span></button>`;
      }).join('')}</div>
    </section>`);
    $('#m-exam').onclick = startExam;
    $('#m-ch').onclick = () => startChapterWeakestOr2();
    $('#m-review').onclick = startReview;
    $('#chapters').onclick = e => { const b = e.target.closest('button[data-chapter]'); if (b) startChapter(+b.dataset.chapter); };
    const imp = $('#impshare');
    if (imp) imp.onclick = function() {
      if (S.pendingShareData) applyImportPairs(S.pendingShareData.pairs);
      clearPendingShare();
      withTransition(gotoIdle);
    };
    const ign = $('#ignshare');
    if (ign) ign.onclick = function() { clearPendingShare(); withTransition(gotoIdle); };
  }
  function startChapterWeakestOr2() {
    const w = weakestChapter(); startChapter(w ? w.id : 2);
  }
  function weakestChapter() {
    let best = null;
    for (const c of CHAPTERS) {
      if (!S.byChapter.get(c.id)) continue;
      if (!best || chapterStats(c.id).pct < chapterStats(best.id).pct) best = c;
    }
    return best;
  }
  function countReview() {
    return S.bank.filter(q => { const r = S.P.get(q.id); return r && (r.status === 'review' || r.flagged); }).length;
  }

  /* ------------------------------------------------ chapter test */
  function startChapter(ch) {
    const pool = S.byChapter.get(ch) || [];
    if (!pool.length) return;
    const tier = s => (s === 'unseen' ? 0 : s === 'review' ? 1 : 2);
    const groups = [[], [], []];
    (shuffle(pool.slice())).forEach(q => groups[tier((S.P.get(q.id) || { status: 'unseen' }).status)].push(q.id));
    const queue = groups[0].concat(groups[1], groups[2]);
    S.stash = null;
    S.view = { mode: 'chapter', chapter: ch, queue, idx: 0, correct: 0, answered: 0 };
    withTransition(renderQuestion);
  }

  /* ------------------------------------------------ review */
  function startReview() {
    const list = [];
    S.bank.forEach(q => { const r = S.P.get(q.id); if (r && r.flagged) list.push(q.id); });
    S.bank.forEach(q => { const r = S.P.get(q.id); if (r && r.status === 'review' && !r.flagged) list.push(q.id); });
    list.reverse();
    if (!list.length) { gotoIdle(); return; }
    S.stash = null;
    S.view = { mode: 'review', queue: list, idx: 0, correct: 0, answered: 0 };
    withTransition(renderQuestion);
  }
  function startExam() {
    // stratified by chapter, proportional to bank size
    if (S.view && S.view.timer) clearInterval(S.view.timer);
    S.stash = null;
    const total = S.bank.length || 1;
    const want = Math.min(S.settings.examLen, S.bank.length);
    const picks = [];
    const per = CHAPTERS.map(c => Math.floor((S.byChapter.get(c.id) || []).length / total * want));
    let sum = per.reduce((a, b) => a + b, 0);
    let pickOffset = 0;
    while (sum < want) {                       // distribute remainder
      const c = CHAPTERS[(want - sum + pickOffset) % CHAPTERS.length];
      if (S.byChapter.get(c.id)) per[c.id - 1]++;
      sum++; pickOffset = (pickOffset + 1) % 7;
    }
    CHAPTERS.forEach(c => {
      const pool = shuffle((S.byChapter.get(c.id) || []).slice());
      picks.push(...pool.slice(0, per[c.id - 1]));
    });
    while (picks.length < want) {
      const q = S.bank[(Math.random() * S.bank.length) | 0];
      if (picks.indexOf(q) < 0) picks.push(q);
    }
    picks.length = want;
    S.view = { mode: 'exam', queue: shuffle(picks.map(q => q.id)), idx: 0, correct: 0, answered: 0, answers: {}, start: Date.now(), left: S.settings.examMinutes * 60, flaggedExam: {} };
    S.view.timer = setInterval(() => {
      S.view.left--;
      const el = $('#timer'); if (el) { el.textContent = mmss(S.view.left); el.classList.toggle('hot', S.view.left < 300); }
      if (S.view.left <= 0) { clearInterval(S.view.timer); S.view.left = 0; }
    }, 1000);
    withTransition(renderQuestion);
  }

  /* ------------------------------------------------ question render */
  function renderQuestion() {
    const v = S.view;
    const qids = v.queue;
    if (v.idx >= qids.length) { v.mode === 'exam' ? withTransition(showResults) : withTransition(showChapterSummary); return; }
    const q = S.byId.get(qids[v.idx]);
    const r = rec(q.id);
    const letters = ['A', 'B', 'C', 'D'];
    const isExam = v.mode === 'exam';
    document.title = (isExam ? 'Exam ' + (v.idx + 1) + '/' + qids.length :
      isReview(v) ? 'Review ' + (v.idx + 1) + '/' + qids.length :
      'Chapter test ' + (v.idx + 1) + '/' + qids.length) + ' · Alberta Class 7 Practice 2026';
    const okN = (v.tally || []).filter(x => x === true).length, noN = (v.tally || []).filter(x => x === false).length;
    const passPct = Math.round(S.settings.passMark * 100);
    const runScore = qids.length ? Math.round(okN / qids.length * 100) : 0;
    const passNote = isExam ? (runScore >= passPct ? ' · <b class="ok-c">passing</b>' : ' · <span class="pass-note">' + passPct + '% to pass</span>') : '';
    const img = q.image ? `<img class="qimg" loading="lazy" src="${esc(q.image)}" alt="Figure for this question: ${esc(q.alt || 'related to the question topic')}">` : '';

    zone(`<section class="card wrap run" aria-label="Question">
      <div class="runtop">
        <div class="left">
          <span class="tag">${isExam ? `Exam ${v.idx + 1}/${qids.length}` : isReview(v) ? `Review ${v.idx + 1}/${qids.length}` : esc(chapterName(v.chapter)) + ' ' + (v.idx + 1) + '/' + qids.length}</span>
          ${isExam ? `<span class="timer" id="timer">${mmss(v.left)}</span>` : ''}
        </div>
        <span class="tally" id="tally" hidden aria-label="Question tally: grey unanswered, green correct, red wrong"></span>
        <span class="progcount" id="progcount" aria-label="${okN} right, ${noN} wrong${v.tally && v.tally.length ? '' : ', no answers yet'}${isExam ? ', pass at ' + passPct + ' percent' : ''}"><b class="ok-c">${okN}</b> / <b class="no-c">${noN}</b>${isExam ? passNote : ''}</span>
        <button class="flagbtn ${r.flagged ? 'on' : ''}" id="flagbtn">⚑ ${r.flagged ? 'Flagged' : 'Flag'}</button>
      </div>
      ${img}
      <div class="qtext">${esc(q.question)}</div>
      <div class="opts">${q.options.map((o, i) =>
        `<button class="opt" data-i="${i}"><span class="l">${letters[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div id="fb" aria-live="polite"></div>
      <div class="nextrow" id="nextrow">
        <button class="btn ghost" id="backbtn" hidden>Back</button>
        ${isExam ? '<button class="btn ghost" id="finishbtn" hidden>Finish exam</button>' : ''}
        <button class="btn" id="nextbtn" hidden>Next</button>
      </div>
    </section>`);

    $('#flagbtn').onclick = () => {
      r.flagged = !r.flagged; persist(q.id);
      const b = $('#flagbtn'); b.classList.toggle('on', r.flagged); b.innerHTML = '⚑ ' + (r.flagged ? 'Flagged' : 'Flag');
    };
    const opts = $('#zone').querySelectorAll('.opt');
    const answered = !!(v.tally && (v.tally[v.idx] === true || v.tally[v.idx] === false));
    const rec0 = (v.answers || {})[q.id];
    if (answered) {                       // returning to an answered question: locked review
      opts.forEach((o, oi) => {
        o.disabled = true;
        if (rec0 && oi === rec0.picked) o.classList.add(rec0.correct ? 'right' : 'wrong');
        else if (rec0) o.classList.add('dim');
      });
    }
    const nb2 = $('#nextbtn');
    const atLast = isExam && v.idx === qids.length - 1;
    if (nb2) {
      nb2.hidden = isExam ? atLast : !answered;
      nb2.onclick = () => {
        if (isExam && !answered) (v.tally = v.tally || [])[v.idx] = 'skip';   // passed over unanswered
        v.idx++; withTransition(renderQuestion);
      };
    }
    const fin = document.getElementById('finishbtn');
    if (fin) {
      fin.hidden = !atLast;
      fin.onclick = () => withTransition(showResults);
    }
    const bb = $('#backbtn');
    if (bb) {
      bb.hidden = v.idx === 0;
      bb.onclick = () => gotoQuestion(v.idx - 1);
    }
    opts.forEach(o => { if (!answered) o.onclick = () => answer(+o.dataset.i, opts, letters); });
    renderTop();
    renderTally();
  }
  function gotoQuestion(k) { S.view.idx = k; withTransition(renderQuestion); }
  function startExamTimer() {
    S.view.timer = setInterval(() => {
      S.view.left--;
      const el = $('#timer'); if (el) { el.textContent = mmss(S.view.left); el.classList.toggle('hot', S.view.left < 300); }
      if (S.view.left <= 0) { clearInterval(S.view.timer); S.view.left = 0; }
    }, 1000);
  }
  function stashRun() {
    const v = S.view;
    if (!v || !v.mode || v.mode === 'idle') return;
    if (v.timer) clearInterval(v.timer);
    S.stash = v;
    gotoIdle();
  }
  function resumeRun() {
    if (!S.stash) return;
    const v = S.stash; S.stash = null;
    S.view = v;
    if (v.mode === 'exam') startExamTimer();
    renderTop();
    withTransition(renderQuestion);
  }
  const isReview = v => v.mode === 'review';

  /* ------------------------------------------------ share/restore UI */
  let pendingRestore = null;
  const restPrev = document.getElementById('restorepreview');
  const restBox = document.getElementById('restorebox');
  const restImp = document.getElementById('doimport'), restIgn = document.getElementById('ignoreimport');
  const shareBox = document.getElementById('shareout');
  function parseBackupText(raw) {
    const data = JSON.parse(raw);
    if (!data || data.app !== 'class7-practice' || !Array.isArray(data.progress)) throw new Error('not a backup');
    return { src: 'file', file: data, seen: data.progress.length, review: data.progress.filter(function(r){ return r.status === 'review'; }).length, flags: data.progress.filter(function(r){ return r.flagged; }).length, sessions: (data.sessions || []).length };
  }
  async function previewRestore(raw) {
    pendingRestore = null; restPrev.textContent = 'Reading…'; restImp.hidden = true; restIgn.hidden = false;
    let info = null;
    try { info = await decodeShareLink(raw); pendingRestore = { src: 'link', data: info }; }
    catch (err) {
      try { info = parseBackupText(raw); pendingRestore = { src: 'file', data: info }; }
      catch (err2) { pendingRestore = null; }
    }
    if (pendingRestore) {
      const d = pendingRestore.data;
      restPrev.textContent = pendingRestore.src === 'link'
        ? d.seen + ' seen · ' + d.review + ' review · ' + d.flags + ' flags — importing fills unanswered questions.'
        : (d.file && d.file.profile ? d.file.profile + ': ' : '') + d.seen + ' records · ' + d.sessions + ' sessions — importing REPLACES this profile.';
      restImp.hidden = false;
    } else {
      const msg = err && err.message ? String(err.message).slice(0, 60) : 'unknown error';
      restPrev.textContent = "Couldn't read that — " + msg + '. Use a Share link or a Backup file.';
    }
  }
  document.getElementById('sharebtn').onclick = async function() {
    restBox.hidden = true;
    const btn = document.getElementById('sharebtn');
    btn.disabled = true; btn.textContent = 'Building…';
    try {
      const inp = document.getElementById('sharelink');
      inp.value = await buildShareLink();
      shareBox.hidden = false;
      inp.focus(); inp.select();
    } catch (err) {}
    btn.disabled = false; btn.textContent = 'Share progress';
  };
  document.getElementById('copyshare').onclick = function() {
    const inp = document.getElementById('sharelink');
    const done = function() { const c = document.getElementById('copyshare'); c.textContent = 'Copied ✓'; setTimeout(function(){ c.textContent = 'Copy link'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, function() { inp.select(); try { document.execCommand('copy'); } catch (e) {} done(); });
    else { inp.focus(); inp.select(); try { document.execCommand('copy'); } catch (e) {} done(); }
  };
  document.getElementById('shortshare').onclick = function() {
    const inp = document.getElementById('sharelink');
    const btn = document.getElementById('shortshare');
    btn.disabled = true; btn.textContent = '…';
    const cb = 'isgd' + Date.now().toString(36);
    window[cb] = function(data) {
      delete window[cb];
      btn.disabled = false; btn.textContent = 'Shorten';
      if (data && data.shorturl) inp.value = data.shorturl;
      else btn.textContent = 'unavailable';
      setTimeout(function(){ btn.textContent = 'Shorten'; }, 2000);
    };
    const s = document.createElement('script');
    s.onload = function() {};
    s.onerror = function() { delete window[cb]; btn.disabled = false; btn.textContent = 'offline'; setTimeout(function(){ btn.textContent = 'Shorten'; }, 2000); };
    s.src = 'https://is.gd/create.php?format=json&callback=' + cb + '&url=' + encodeURIComponent(inp.value);
    document.head.appendChild(s);
  };
  document.getElementById('dlbackup').onclick = function() {
    saveCurrentProfile();
    const name = currentProfile();
    const payload = { app: 'class7-practice', version: APP_VERSION, profile: name, created: new Date().toISOString(), progress: (profilesReg[name] && profilesReg[name].p) || [], sessions: S.sessions.slice(), stash: S.stash || null };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'class7-practice-backup-' + name.replace(/[^\w-]+/g, '_') + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1200);
  };
  document.getElementById('restorebtn').onclick = function() {
    shareBox.hidden = true; restBox.hidden = false;
    const inp = document.getElementById('restorelink');
    inp.value = ''; restPrev.textContent = ''; restImp.hidden = true;
    inp.focus();
  };
  const restInput = document.getElementById('restorelink');
  let restDebounce = 0;
  restInput.addEventListener('input', function() {
    clearTimeout(restDebounce);
    const raw = restInput.value;
    if (!raw) { pendingRestore = null; restPrev.textContent = ''; restImp.hidden = true; return; }
    restPrev.textContent = 'Reading…'; restImp.hidden = true;
    restDebounce = setTimeout(function() { previewRestore(raw); }, 180);
  });
  document.getElementById('restorefile').addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function() { previewRestore(String(reader.result)); };
    reader.readAsText(file);
  });
  restImp.onclick = function() {
    if (!pendingRestore) return;
    if (pendingRestore.src === 'link') {
      applyImportPairs(pendingRestore.data.pairs);
    } else {
      const bak = pendingRestore.data.file;
      const recs = (bak.progress || []).map(function(r){ return { qid: r.qid, status: r.status, attempts: r.attempts || 0, reviewStreak: r.reviewStreak || 0, flagged: !!r.flagged, lastResult: r.lastResult || null, updatedAt: r.updatedAt || 0 }; });
      S.P = new Map(recs.map(function(r){ return [r.qid, r]; }));
      bulkPersist();
      S.sessions = (bak.sessions || []).slice();
      S.sessions.forEach(function(s2){ if (window.DB) DB.addSession(s2); });
      S.stash = bak.stash || null;
      saveCurrentProfile();
      gotoIdle();
    }
    restPrev.textContent = 'Imported ✓';
    pendingRestore = null; restImp.hidden = true; restIgn.hidden = true;
    setTimeout(function(){ restBox.hidden = true; }, 1200);
  };
  restIgn.onclick = function() { pendingRestore = null; restBox.hidden = true; };

  /* ------------------------------------------------ answering */
  function renderTally() {
    const t = document.getElementById('tally'); if (!t) return;
    const v = S.view; if (!v || !v.queue) return;
    const n = v.queue.length, marks = v.tally || [];
    let html = '';
    for (let k = 0; k < n; k++) html += `<i class="${marks[k] === undefined ? 'todo' : (marks[k] === 'skip' ? 'skip' : (marks[k] ? 'ok' : 'no'))}"></i>`;
    t.innerHTML = html;
    t.hidden = false;
  }

  function answer(i, opts, letters) {
    const v = S.view;
    const q = S.byId.get(v.queue[v.idx]);
    const r = rec(q.id);
    const correct = i === q.answer;
    v.answered++;
    (v.tally = v.tally || [])[v.idx] = correct;

    opts.forEach(o => {
      const oi = +o.dataset.i; o.disabled = true;
      if (oi === q.answer) o.classList.add('right');
      else if (oi === i) o.classList.add('wrong');
      else o.classList.add('dim');
    });

    let fb = '';
    v.answers = v.answers || {};
    v.answers[q.id] = { picked: i, correct: correct };
    if (v.mode === 'exam') {
      if (correct) v.correct++;
      else {
        r.attempts++; r.lastResult = false; persist(q.id);   // exam never touches status/confidence
        if (r.status === 'unseen') { r.status = 'review'; persist(q.id); }
      }
    } else {
      // practice answer — confidence rules
      const wasKnown = r.status === 'known';
      const wasReview = r.status === 'review';
      if (correct) {
        v.correct++;
        if (wasReview) {
          r.reviewStreak = (r.reviewStreak || 0) + 1;
          if (r.reviewStreak >= 2) r.status = 'known';
          fb = r.status === 'known'
            ? `<div class="feedback ok"><b>Correct — mastered!</b> ${esc(q.explanation)}${src(q)}</div>`
            : `<div class="feedback ok"><b>Correct</b> ${esc(q.explanation)}${src(q)}</div>`;
        } else if (!wasKnown) {
          r.status = 'known';
          fb = `<div class="feedback ok"><b>Correct — confidence up</b> ${esc(q.explanation)}${src(q)}</div>`;
        } else {
          fb = `<div class="feedback ok"><b>Correct</b> ${esc(q.explanation)}${src(q)}</div>`;
        }
      } else {
        r.attempts++; r.lastResult = false;
        if (wasKnown) { r.status = 'review'; r.reviewStreak = 0; persist(q.id); fb = `<div class="feedback no"><b>Reset —</b> that question drops back into review. ${esc(q.explanation)}${src(q)}</div>`; }
        else if (wasReview) { r.reviewStreak = 0; persist(q.id); fb = `<div class="feedback no"><b>Wrong</b> ${esc(q.explanation)}${src(q)}</div>`; }
        else { r.status = 'review'; persist(q.id); fb = `<div class="feedback no"><b>Wrong — added to review</b> ${esc(q.explanation)}${src(q)}</div>`; }
      }
      persist(q.id);
      renderTop();
      renderTally();
    }

    $('#fb').innerHTML = fb + flagHtml(q);
    const fq = $('#flagq');
    if (fq) fq.onclick = () => open('https://github.com/icyavocado/class7-practice/issues/new'
      + '?template=question-report.yml&question-id=' + encodeURIComponent(q.id)
      + '&guide-section=' + encodeURIComponent(q.source ? q.source.section : ''), '_blank');
    const nb = $('#nextbtn'), pc = $('#progcount');
    if (nb) nb.hidden = false;
    if (pc) {
      const passPct = Math.round(S.settings.passMark * 100);
      const ok = (v.tally || []).filter(x => x === true).length, no = (v.tally || []).filter(x => x === false).length;
      let note = '';
      if (v.mode === 'exam') {
        const score = no + ok ? Math.round(ok / (no + ok) * 100) : 0;
        note = score >= passPct ? ' · <b class="ok-c">passing</b>' : ' · <span class="pass-note">' + passPct + '% to pass</span>';
      }
      pc.innerHTML = `<b class="ok-c">${ok}</b> / <b class="no-c">${no}</b>${note}`;
      pc.setAttribute('aria-label', ok + ' right, ' + no + ' wrong' + (note ? ', pass at ' + passPct + ' percent' : ''));
    }
    $('#nextbtn').focus();
  }

  function src(q) {
    if (!q.source) return '';
    const a = q.source.anchor || '';
    const href = './drivers-guide-2026.md' + a;
    return `<span class="src">Source: <a href="${href}" target="_blank">Chapter ${q.source.chapter} → ${esc(q.source.section)}</a></span>`;
  }
  function chapterName(c) { const ch = CHAPTERS.find(x => x.id === c); return ch ? ch.name : ''; }
  function flagHtml(q) {
    const votes = (window.QUESTION_VOTES[q.id]) || {};
    const n = votes.up || 0, m = votes.down || 0;
    const signal = (n || m) ? ` · <span class="cvsig">${m} community report${m === 1 ? '' : 's'}${n ? `, ${n} endorse${n === 1 ? 's' : ''}` : ''}</span>` : '';
    return `<button class="setbtn flagq" id="flagq" title="Open a GitHub issue to endorse or report this question">Report question</button>${signal}`;
  }

  /* ------------------------------------------------ summaries */
  function showChapterSummary() {
    const v = S.view;
    v.done = true;
    renderTop();
    const pct = v.answered ? Math.round(v.correct / v.answered * 100) : 0;
    const label = v.mode === 'review' ? 'Review' : esc(chapterName(v.chapter));
    zone(`<section class="card wrap results" aria-label="Results">
      <div class="scoreline" tabindex="-1"><span class="score">${pct}%</span><span class="${pct >= 80 ? 'pass' : 'fail'}">${pct >= 80 ? 'Nice work' : 'Needs more reps'}</span></div>
      <div class="muted">${v.correct}/${v.answered} correct in ${label}. Missed questions went to Review. Mastered questions you miss drop back to review.</div>
      <div class="nextrow">
        <button class="btn ghost" id="home">Home</button>
        <button class="btn" id="again">Practice again</button>
      </div></section>`);
    $('#home').onclick = () => withTransition(gotoIdle);
    $('#again').onclick = () => startChapter(v.chapter);
  }

  function showResults() {
    if (S.view && S.view.timer) clearInterval(S.view.timer);
    const v = S.view;
    v.done = true;
    clearInterval(v.timer);
    const pct = v.queue.length ? Math.round(v.correct / v.queue.length * 100) : 0;
    const pass = pct / 100 >= S.settings.passMark;
    const session = { mode: 'exam', date: new Date().toISOString(), score: pct, correct: v.correct, total: v.queue.length, passed: pass, seconds: S.settings.examMinutes * 60 - Date.now() / 1000 };
    session.seconds = Math.round(session.seconds);
    DB.addSession(session).then(() => { S.sessions.push(session); renderTop(); });
    renderTop();
    const skipped = v.queue.filter(id => !v.answers[id]);
    skipped.forEach(id => { const r = rec(id); if (r.status === 'unseen') { r.status = 'review'; persist(id); } });
    const missed = v.queue.map(id => ({ q: S.byId.get(id), a: v.answers[id] })).filter(x => !x.a || !x.a.correct);
    const lines = CHAPTERS.map(c => {
      const rows = v.queue.map(id => S.byId.get(id)).filter(q => q.chapter === c.id);
      if (!rows.length) return '';
      const ok = rows.filter(q => v.answers[q.id] && v.answers[q.id].correct).length;
      const p = Math.round(ok / rows.length * 100);
      return `<div class="crow"><div class="n">${esc(c.name)} — ${ok}/${rows.length}</div><div class="b"><i style="width:${p}%"></i></div></div>`;
    }).join('');
    zone(`<section class="card wrap results" aria-label="Results">
      <div class="scoreline" tabindex="-1" id="resulthead"><span class="score">${pct}%</span><span class="${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'}</span>
        <span class="muted">${v.correct}/${v.queue.length} · skipped ${skipped.length} · pass mark ${Math.round(S.settings.passMark * 100)}% · time used ${mmss(S.settings.examMinutes * 60 - v.left)}</span></div>
      <div class="chaptersum">${lines}</div>
      <div class="muted" style="font-weight:600">Questions you missed or skipped (now in Review):</div>
      <div class="missed">${missed.map(m => `<details><summary>${esc(m.q.question)}</summary>
        <div class="ans">${m.a ? 'Correct: ' : 'Skipped — correct: '}${esc(m.q.options[m.q.answer])}</div>
        <div>${esc(m.q.explanation)}</div>
        ${m.q.source ? `<div class="src"><a href="./drivers-guide-2026.md${m.q.source.anchor}" target="_blank">Chapter ${m.q.source.chapter} → ${esc(m.q.source.section)}</a></div>` : ''}
      </details>`).join('') || '<div class="muted">None — perfect paper.</div>'}</div>
      <div class="nextrow"><button class="btn ghost" id="home">Home</button><button class="btn" id="again">New exam</button></div>
    </section>`);
    document.getElementById('resulthead').focus();
    $('#home').onclick = () => withTransition(gotoIdle);
    $('#again').onclick = startExam;
  }
})();
