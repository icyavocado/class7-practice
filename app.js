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
  // community reports -> Supabase (project URL + public publishable key)
  const REPORTS_URL = 'https://uvlhzgndmzjyqlzdmdgn.supabase.co';
  const REPORTS_PUBLISHABLE = 'sb_publishable_2XnLRar3qhhMVLckmcyhkQ_iquv0rqa';

  function deviceId() {
    let d = localStorage.getItem('report-device');
    if (!d) { d = 'dv-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('report-device', d); }
    return d;
  }
  const reportSessionToken = () => 'st-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  async function sendReportVote(qid, vote, reason) {
    const r = await fetch(REPORTS_URL + '/functions/v1/report-vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + REPORTS_PUBLISHABLE },
      body: JSON.stringify(Object.assign(
        { bank_id: S.activeBank || 'default', qid, vote, device_id: deviceId(), session_token: reportSessionToken() },
        reason ? { reason: String(reason).slice(0, 500) } : {})),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    return j; // { ok, up, down, recorded }
  }
  async function reportSignal(bankId, qid) {
    const qs = 'bank_id=eq.' + encodeURIComponent(bankId) + '&qid=eq.' + encodeURIComponent(qid) + '&select=up,down,answers';
    const r = await fetch(REPORTS_URL + '/rest/v1/question_signal?' + qs, {
      headers: { apikey: REPORTS_PUBLISHABLE, authorization: 'Bearer ' + REPORTS_PUBLISHABLE },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json())[0] || { up: 0, down: 0, answers: 0 };
  }
  // chip label: answered count + report count, non-zero parts only
  function sigLabel(sig) {
    const bits = [];
    if (sig && sig.answers) bits.push(sig.answers + ' answered');
    if (sig && sig.down) bits.push(sig.down + ' report' + (sig.down === 1 ? '' : 's'));
    return bits.join(' \u00b7 ');
  }
  // merges a fresh server signal into the cache; the answered count only
  // grows per question, so a max() defends against GET/POST races
  function mergeSignal(qid, fresh) {
    const cache = (window.SIGNAL_CACHE = window.SIGNAL_CACHE || {});
    const cur = cache[qid] || {};
    const merged = { up: fresh.up || 0, down: fresh.down || 0, answers: Math.max(fresh.answers || 0, cur.answers || 0) };
    cache[qid] = merged;
    return merged;
  }
  // pushes a fresh signal into every rendered chip (feedback bar + runtop)
  function refreshSignalChips(qid, sig) {
    const label = sigLabel(sig);
    const bar = document.querySelector('#fb .votebar');
    let chip = document.querySelector('#fb .cvsig');
    if (label && bar && !chip) {
      chip = document.createElement('span'); chip.className = 'cvsig';
      bar.appendChild(chip);
    }
    if (chip) { chip.textContent = label; chip.style.display = label ? '' : 'none'; }
    const top = document.querySelector('.runtopsig');
    if (top) { top.textContent = label; top.style.display = label ? '' : 'none'; }
  }
  // the first answer of a question on this device pings the server once, so
  // the community answered-count grows across users; repeats stay local
  function answeredSet() {
    const k = 'answer-pinged-' + (S.activeBank || 'default');
    let seen;
    try { seen = new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch (e) { seen = new Set(); }
    return {
      has: q => seen.has(q),
      add: q => { seen.add(q); try { localStorage.setItem(k, JSON.stringify([...seen].slice(-2000))); } catch (e) {} },
    };
  }
  function pingAnswered(qid) {
    const seen = answeredSet();
    if (seen.has(qid)) return;
    sendReportVote(qid, 'answered').then(function (res) {
      seen.add(qid);
      if (res && typeof res.answers === 'number') refreshSignalChips(qid, mergeSignal(qid, res));
    }).catch(function () {});
  }
  window.SIGNAL_CACHE = window.SIGNAL_CACHE || {};
  const withTransition = fn => {
    // Intra-run question swaps skip the view transition: rapid navigation keeps
    // superseding transitions, leaving stale frozen frames (e.g. an unchanging tally).
    if (fn === renderQuestion || !document.startViewTransition || noMotion.matches) { fn(); return; }
    const vt = document.startViewTransition(fn);
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
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
    return Promise.all([DB.getAllState(), DB.getSessions(), DB.getMeta('settings'), DB.getMeta('profiles'), DB.getMeta('banks'), DB.getMeta('genconf')]);
  }).then(async ([states, sessions, settings, profiles, banksMeta, genconf]) => {
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
   // custom banks + active bank
   S.banks = banksMeta || {};
   S.genconf = genconf || { provider: 'openai', key: '', base: '', model: '' };
   S.activeBank = S.settings.activeBank || 'default';
   if (S.activeBank !== 'default' && !S.banks[S.activeBank]) { S.activeBank = 'default'; S.settings.activeBank = 'default'; DB.putMeta('settings', S.settings); }
   if (S.activeBank === 'default') setBankData(window.QUESTIONS || [], CHAPTERS);
   else setBankData(S.banks[S.activeBank].questions, S.banks[S.activeBank].chapters);
   // a stashed run must belong to the active bank
   if (S.stash && (!S.stash.queue || !S.stash.queue.every(id => S.byId.has(id)))) S.stash = null;
    if (!S.stash && (location.hash === '#resume' || /^(exam|chapter|review)\//.test(location.hash.slice(1)))) {
      profilesReg = await DB.getMeta('profiles') || profilesReg;
      const retry = (profilesReg[name] || {}).stash;
      if (retry && retry.queue && retry.queue.every && retry.queue.every(id => S.byId.has(id))) S.stash = retry;
      navReplace(hashFor(S.view && S.view.mode, S.view && S.view.idx, false));
    }
    if (hash.indexOf('p1') === 0) {
      decodeShareLink(hash).then(function(data) {
        S.pendingShareData = data; S.pendingShareError = null;
        if (S.view && S.view.mode === 'idle') withTransition(gotoIdle);
      }).catch(function() {
        S.pendingShareError = true; S.pendingShareData = null;
        if (S.view && S.view.mode === 'idle') withTransition(gotoIdle);
      });
    }
    const mRun = hash.match(/^(exam|chapter|review)\/(\d+)$/);
    if (S.stash && (!mRun || S.stash.mode === mRun[1])) {
      const v = S.stash; S.stash = null; S.view = v; saveCurrentProfile();
      const want = mRun ? parseInt(mRun[2], 10) - 1 : v.idx;
      S.view.idx = Math.max(0, Math.min(want, S.view.queue.length - 1));
      if (S.view.mode === 'exam') startExamTimer();
      renderTop(); withTransition(renderQuestion);
    } else {
      if (mRun) navReplace('#home');   // stale run link — nothing to resume
      withTransition(gotoIdle);
    }
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
      if (S.activeBank !== 'default') commitBankProgress();
      const name = currentProfile();
      const base = profilesReg[name] || { created: Date.now() };
      const rec = {
        p: base.p || [], sessions: S.sessions.slice(), banks: base.banks || {},
        stash: S.stash ? JSON.parse(JSON.stringify(S.stash)) : null,
        created: base.created || Date.now(),
      };
      if (S.activeBank === 'default') rec.p = [...S.P.values()].map(r => ({ ...r }));
      else rec.banks[S.activeBank] = { p: [...S.P.values()].map(r => ({ ...r })) };
      profilesReg[name] = rec;
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
      if (S.activeBank === 'default') DB.putState(r);
      else commitBankProgress();
    }
    let saveBankTimer = 0;
    function saveBankProgress() {
      clearTimeout(saveBankTimer);
      saveBankTimer = setTimeout(commitBankProgress, 250);
    }
    function commitBankProgress() {
      if (!S.P || S.activeBank === 'default') return;
      const name = currentProfile();
      const base = profilesReg[name] || { created: Date.now() };
      const banks = base.banks || (base.banks = {});
      banks[S.activeBank] = { p: [...S.P.values()].map(r => Object.assign({}, r)) };
      base.banks = banks; profilesReg[name] = base; DB.putMeta('profiles', profilesReg);
    }

  /* confidence: known / total per chapter */
  function chapterStats(c) {
    const pool = S.byChapter.get(c) || [];
    let known = 0;
    pool.forEach(q => { const r = S.P.get(q.id); if (r && r.status === 'known') known++; });
    return { known, total: pool.length, pct: pool.length ? known / pool.length : 0 };
  }

  /* ------------------------------------------------ appearance */
  const APP_VERSION = 'v1.2';
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
    const resumeLbl = (!activeRun && S.stash) ? (S.stash.mode === 'exam' ? (compact ? 'Resume' : 'Resume test') : (compact ? 'Resume' : 'Resume practice')) : null;
    updateRing(activeRun);
    paintBankRow();
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
      refreshProfRow();
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
    navReplace('#home');
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
      <div id="chapters">${S.chapters.map(c => {
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
    for (const c of S.chapters) {
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
    navPush(hashFor('chapter', 0, false));
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
    navPush(hashFor('review', 0, false));
    withTransition(renderQuestion);
  }
  function startExam() {
    // stratified by chapter, proportional to bank size
    if (S.view && S.view.timer) clearInterval(S.view.timer);
    S.stash = null;
    const total = S.bank.length || 1;
    const want = Math.min(S.settings.examLen, S.bank.length);
    const picks = [];
    const per = S.chapters.map(c => Math.floor((S.byChapter.get(c.id) || []).length / total * want));
    let sum = per.reduce((a, b) => a + b, 0);
    let pickOffset = 0;
    while (sum < want) {                       // distribute remainder
      const c = S.chapters[(want - sum + pickOffset) % S.chapters.length];
      if (S.byChapter.get(c.id)) per[c.id - 1]++;
      sum++; pickOffset = (pickOffset + 1) % 7;
    }
    S.chapters.forEach(c => {
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
    navPush(hashFor('exam', 0, false));
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
        const m = (v.tally || [])[v.idx];                 // live state: 'skip' only if still unanswered
        if (isExam && m !== true && m !== false) (v.tally = v.tally || [])[v.idx] = 'skip';
        v.idx++;
        history.pushState(null, '', hashFor(v.mode, v.idx, false));
        withTransition(renderQuestion);
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
    navReplace(hashFor(v.mode, v.idx, false));
    syncStash();
    refreshSignalFor(q);
  }
  // shows the community signal next to the tally on every rendered question
  // (locked revisits included); fresh questions simply stay silent until votes
  // exist.
  function refreshSignalFor(q) {
    if (window.__sigPending === q.id) return;
    window.__sigPending = q.id;
    reportSignal(S.activeBank || 'default', q.id).then(function (sig) {
      window.__sigPending = q.id === window.__sigPending ? null : window.__sigPending;
      sig = mergeSignal(q.id, sig);
      const tally = document.getElementById('tally');
      if (!tally || !tally.parentElement) return;
      let chip = tally.parentElement.querySelector('.runtopsig');
      if (!chip) {
        chip = document.createElement('span'); chip.className = 'cvsig runtopsig';
        tally.insertAdjacentElement('afterend', chip);
      }
      const label = sigLabel(sig);
      if (label) { chip.textContent = label; chip.style.display = ''; }
      else chip.style.display = 'none';
    }).catch(function () { window.__sigPending = null; });
  }
  // keeps the parked run in the profile meta continuously: an unload-time
  // IndexedDB write can fail to flush, so the stash is persisted as the run
  // goes (pagehide remains only as a last-chance catch).
  function syncStash() {
    const v = S.view;
    if (!v || !v.mode || v.mode === 'idle' || v.done) return;
    const { timer, ...rest } = v;
    S.stash = JSON.parse(JSON.stringify(rest));
    saveCurrentProfile();
  }
  function gotoQuestion(k) {
    history.pushState(null, '', hashFor(S.view, k));
    S.view.idx = k;
    withTransition(renderQuestion);
  }
  function startExamTimer() {
    S.view.timer = setInterval(() => {
      S.view.left--;
      const el = $('#timer'); if (el) { el.textContent = mmss(S.view.left); el.classList.toggle('hot', S.view.left < 300); }
      if (S.view.left <= 0) { clearInterval(S.view.timer); S.view.left = 0; }
    }, 1000);
  }
  function parkRun(outHash) {
    const v = S.view;
    if (!v || !v.mode || v.mode === 'idle') { navReplace('#home'); return; }
    if (v.timer) clearInterval(v.timer);
    if (!v.done) {
      const { timer, ...rest } = v;
      S.stash = JSON.parse(JSON.stringify(rest));
      saveCurrentProfile();
    }
    history.replaceState(null, '', outHash || hashFor(v.mode, v.idx, v.done));
  }
  function stashRun() {
    parkRun();
    gotoIdle();
  }
  window.addEventListener('pagehide', parkRun);
  window.addEventListener('beforeunload', parkRun);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') parkRun(); });
  function resumeRun() {
    if (!S.stash) return;
    const v = S.stash; S.stash = null;
    S.view = v;
    saveCurrentProfile();
    if (v.mode === 'exam') startExamTimer();
    navReplace(hashFor(v.mode, v.idx, v.done));
    renderTop();
    withTransition(renderQuestion);
  }
  const isReview = v => v.mode === 'review';

    /* ================================================ custom banks: PDF -> practice test */
    function getBanks() { if (!S.banks) S.banks = {}; return S.banks; }
    function setBankData(questions, chapters) {
      S.bank = questions.slice();
      S.chapters = chapters.slice();
      S.byId = new Map(S.bank.map(q => [q.id, q]));
      S.byChapter = new Map();
      S.bank.forEach(q => {
        if (!S.byChapter.has(q.chapter)) S.byChapter.set(q.chapter, []);
        S.byChapter.get(q.chapter).push(q);
      });
    }
    function paintBankRow() {
      const row = document.getElementById('bankrow'); if (!row) return;
      const banks = getBanks();
      const opts = ['<option value="default"' + (S.activeBank === 'default' ? ' selected' : '') + '>Alberta guide (built-in)</option>']
        .concat(Object.keys(banks).map(bid => '<option value="' + bid + '"' + (S.activeBank === bid ? ' selected' : '') + '>' + esc(banks[bid].name) + '</option>'));
      row.innerHTML = '<select id="bankpick" class="profpick" title="Switch practice test">' + opts.join('') + '</select>' +
        (S.activeBank === 'default'
          ? '<button class="profbtn" id="banknew" title="Create a practice test from a PDF">+</button>'
          : '<button class="profbtn" id="bankdel" title="Delete this practice test">\u00d7</button>');
      document.getElementById('bankpick').onchange = () => switchBank(document.getElementById('bankpick').value);
      const nw = document.getElementById('banknew');
      if (nw) nw.onclick = openGenerator;
      const del = document.getElementById('bankdel');
      if (del) del.onclick = () => { if (confirm('Delete this practice test and its progress?')) deleteBank(S.activeBank); };
      const sb = document.getElementById('sharebtn'), rb = document.getElementById('restorebtn');
      const hideShare = S.activeBank !== 'default';
      if (sb) sb.hidden = hideShare;
      if (rb) rb.hidden = hideShare;
    }
    async function switchBank(bid) {
      if (!bid || bid === S.activeBank) return;
      const banks = getBanks();
      if (bid !== 'default' && !banks[bid]) return;
      if (S.view && S.view.mode && S.view.mode !== 'idle' && !S.view.done) { parkRun('#home'); S.view = { mode: 'idle' }; }
      S.activeBank = bid; S.settings.activeBank = bid; DB.putMeta('settings', S.settings);
      if (bid === 'default') {
        setBankData(window.QUESTIONS || [], CHAPTERS);
        const states = await DB.getAllState();
        S.P = new Map(states.map(r => [r.qid, Object.assign({}, r)]));
        S.stash = null;
      } else {
        const b = banks[bid];
        setBankData(b.questions, b.chapters);
        const prof = profilesReg[currentProfile()] || {};
        const bp = (prof.banks || {})[bid] || { p: [], sessions: [] };
        S.P = new Map(bp.p.map(r => [r.qid, Object.assign({}, r)]));
        S.stash = null;
      }
      gotoIdle();
    }
    function deleteBank(bid) {
      if (bid === 'default') return;
      const banks = getBanks(); delete banks[bid]; DB.putMeta('banks', banks);
      if (S.activeBank === bid) switchBank('default'); else paintBankRow();
    }
    async function openGenerator() {
      document.getElementById('settings').hidden = true;
      gearbtn.setAttribute('aria-expanded', 'false');
      await ensurePdfJs();
      const h = location.hash.slice(1);
      if (h !== 'generate') history.pushState(null, '', '#generate');
      S.view = { mode: 'generator' }; S.gen = { cancelled: false, file: null, pages: null, chaps: null, counts: null, bankName: '' };
      navReplace('#generate'); renderGenerator();
    }
    function renderGenerator() {
      const conf = getGenConf();
      zone('<section class="card wrap generator" aria-label="Generate a practice test">' +
        '<div style="font-size:15px;font-weight:600;margin:0 0 10px">New practice test from a PDF</div>' +
        '<div class="muted">Drop a text-based PDF (study guide, course notes), review the chapters, and generate a multiple-choice practice test with your own AI provider.</div>' +
        '<div class="genstep"><div class="setlabel">1 | AI provider (key stays on this device)</div>' +
        '<div class="profrow"><select id="genprovider" class="profpick">' +
        '<option value="openai"' + (conf.provider === 'openai' ? ' selected' : '') + '>OpenAI-compatible (OpenAI, OpenRouter, Groq, Ollama\u2026)</option>' +
        '<option value="anthropic"' + (conf.provider === 'anthropic' ? ' selected' : '') + '>Anthropic</option>' +
        '<option value="gemini"' + (conf.provider === 'gemini' ? ' selected' : '') + '>Google Gemini</option>' +
        '</select><input id="genkey" class="sharelink" type="password" placeholder="API key" value="' + esc(conf.key) + '" style="max-width:210px">' +
        '<input id="genbase" class="sharelink" placeholder="Base URL" value="' + esc(conf.base) + '" style="max-width:220px">' +
        '<input id="genmodel" class="sharelink" placeholder="Model" value="' + esc(conf.model) + '" style="max-width:180px">' +
        '<button class="setbtn" id="gentest">Test</button></div><div class="muted" id="gentestout" style="font-size:11.5px"></div></div>' +
        '<div class="genstep"><div class="setlabel">2 | PDF</div>' +
        '<div class="genzone" id="genzone"><input type="file" id="genfile" accept="application/pdf" hidden><button class="setbtn" id="genpick">Choose PDF\u2026</button> <span class="muted">or drop a file here</span> <span id="genfileinfo" class="muted"></span></div>' +
        '<div class="muted" id="genextract"></div></div>' +
        '<div class="genstep" id="genchapstep" hidden><div class="setlabel">3 | Chapters and questions per chapter</div>' +
        '<div id="genchapters"></div><div class="profrow" style="margin-top:8px">' +
        '<button class="setbtn" id="genall">Set all to\u2026</button>' +
        '<select id="gencountall" class="profpick"><option>5</option><option selected>10</option><option>20</option><option>50</option></select>' +
        '<input id="genbankname" class="sharelink" style="max-width:220px" placeholder="Test name (from the file)"></div></div>' +
        '<div class="genstep"><button class="btn" id="genrun" hidden>Generate</button>' +
        '<button class="setbtn" id="gencancel" hidden>Cancel</button>' +
        '<div class="muted" id="genprogress"></div><div id="generr" class="muted"></div></div></section>');
      $('#genprovider').onchange = () => { saveGenConf(); renderGenerator(); };
      ['genkey', 'genbase', 'genmodel'].forEach(id => { document.getElementById(id).onchange = saveGenConf; });
      $('#gentest').onclick = testProvider;
      $('#genpick').onclick = () => document.getElementById('genfile').click();
      const dz = document.getElementById('genzone');
      ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('on'); }));
      ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('on'); }));
      dz.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) pickPdf(f); });
      document.getElementById('genfile').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) pickPdf(f); };
      document.getElementById('genall').onclick = () => { const v = document.getElementById('gencountall').value; [...document.querySelectorAll('.gcount')].forEach(i => i.value = v); saveCounts(); };
      document.getElementById('genchapters').addEventListener('input', saveCounts);
      document.getElementById('genrun').onclick = runGeneration;
      document.getElementById('gencancel').onclick = () => { S.gen.cancelled = true; document.getElementById('genprogress').textContent = 'Cancelling...'; };
    }
    function gotoGenStep3() {
      document.getElementById('genchapstep').hidden = false;
      document.getElementById('genrun').hidden = false;
      if (!document.getElementById('genbankname').value) document.getElementById('genbankname').value = S.gen.bankName;
      document.getElementById('genchapters').innerHTML = S.gen.chaps.map((c, i) =>
        '<div class="profrow" style="margin:6px 0">' +
        '<input class="sharelink gname" data-i="' + i + '" style="max-width:260px" value="' + esc(c.name) + '">' +
        '<input class="sharelink gcount" data-i="' + i + '" type="number" min="1" max="50" value="' + ((S.gen.counts || [])[i] || 10) + '" style="max-width:70px">' +
        '<span class="muted">pages ' + c.from + ' \u2013 ' + c.to + '</span></div>').join('');
    }
    function saveCounts() {
      const counts = [];
      document.querySelectorAll('.gcount').forEach(i => counts[+i.dataset.i] = Math.max(1, Math.min(50, +i.value || 10)));
      document.querySelectorAll('.gname').forEach(i => { S.gen.chaps[+i.dataset.i].name = i.value; });
      S.gen.counts = counts;
    }
    function saveGenConf() {
      const conf = {
        provider: document.getElementById('genprovider').value,
        key: document.getElementById('genkey').value,
        base: document.getElementById('genbase').value.trim(),
        model: document.getElementById('genmodel').value.trim(),
      };
      S.genconf = conf;
      if (window.DB) DB.putMeta('genconf', conf);
      return conf;
    }
    function getGenConf() { S.genconf = S.genconf || { provider: 'openai', key: '', base: '', model: '' }; return S.genconf; }
    async function testProvider() {
      const conf = saveGenConf();
      const out = document.getElementById('gentestout');
      out.textContent = 'Testing...';
      try {
        const t = await callProvider(conf, 'Reply with exactly: OK');
        out.textContent = t.includes('OK') ? 'Connected \u2014 provider works.' : 'Connected \u2014 unexpected reply: ' + t.slice(0, 80);
      } catch (err) { out.textContent = 'Failed \u2014 ' + String(err.message || err).slice(0, 140); }
    }
    async function ensurePdfJs() {
      if (window.pdfjsLib) return;
      await new Promise((res, rej) => {
        const s2 = document.createElement('script');
        s2.src = 'lib/pdf.min.js'; s2.onload = res; s2.onerror = () => rej(new Error('Could not load the PDF reader'));
        document.head.appendChild(s2);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    }
    async function pickPdf(file) {
      S.gen.file = file; S.gen.cancelled = false; S.gen.chaps = null;
      document.getElementById('genfileinfo').textContent = file.name + ' \u00b7 ' + (file.size / 1024 | 0) + ' KB';
      const out = document.getElementById('genextract');
      out.textContent = 'Extracting text...';
      try {
        const pages = await pdfToText(file, (p, n) => { out.textContent = 'Extracting text... page ' + p + '/' + n; });
        S.gen.pages = pages;
        S.gen.chaps = splitChapters(pages);
        S.gen.bankName = file.name.replace(/\.pdf$/i, '').slice(0, 40);
        out.textContent = pages.length + ' pages, ' + pages.reduce((a, p) => a + p.text.length, 0) + ' chars of text extracted.';
      } catch (err) {
        out.textContent = 'Could not read that PDF \u2014 ' + String(err.message || err).slice(0, 120) + ' (image-only/scanned PDFs are not supported yet).';
        return;
      }
      gotoGenStep3();
    }
    async function pdfToText(file, onProgress) {
      await ensurePdfJs();
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const c = await (await doc.getPage(p)).getTextContent();
        pages.push({ page: p, text: c.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim() });
        if (onProgress) onProgress(p, doc.numPages);
      }
      return pages;
    }
    function splitChapters(pages) {
      const out = [];
      const seen = {};
      for (const pg of pages) {
        if (!pg.text) continue;
        const m = pg.text.match(/(?:chapter|part|section)\s+(\d{1,2})\b[.:\u2014-]?\s*([A-Za-z][^\n]{3,60})/i) || pg.text.match(/\b([A-Z][A-Za-z,'\u2019 -]{8,60})\b/);
        const name = (m && (m[2] || m[3])) ? (m[2] || m[3]).trim().slice(0, 40) : (pg.text.slice(0, 24) || 'Pages ' + pg.page);
        const key = name.toLowerCase();
        const last = out[out.length - 1];
        if (seen[key] && last) { last.to = pg.page; continue; }
        if (out.length >= 20) { last.to = pg.page; continue; }
        seen[key] = 1;
        out.push({ from: pg.page, to: pg.page, name });
      }
      return out.length ? out : [{ from: pages[0].page, to: pages[pages.length - 1].page, name: 'Full document' }];
    }
    async function runGeneration() {
      const conf = saveGenConf();
      if (!S.gen.chaps) return;
      saveCounts();
      const name = (document.getElementById('genbankname').value || S.gen.bankName || 'My practice test').trim();
      S.gen.cancelled = false;
      document.getElementById('genrun').hidden = true;
      document.getElementById('gencancel').hidden = false;
      const out = document.getElementById('genprogress'), errBox = document.getElementById('generr');
      errBox.textContent = '';
      const questions = [];
      let failure = null;
      for (let ci = 0; ci < S.gen.chaps.length; ci++) {
        if (S.gen.cancelled) { out.textContent = 'Cancelled.'; break; }
        const ch = S.gen.chaps[ci];
        out.textContent = 'Generating... chapter ' + (ci + 1) + '/' + S.gen.chaps.length + ' (' + ch.name + ')';
        const material = S.gen.pages.filter(p => p.page >= ch.from && p.page <= ch.to)
          .map(p => '[page ' + p.page + '] ' + p.text).join('\n').slice(0, 24000);
        const user = [
          'Create exactly ' + (S.gen.counts[ci] || 10) + ' multiple-choice practice questions grounded STRICTLY in the material below.',
          'Rules: exactly 4 options per question; exactly one unambiguously correct ("answer" is 0-3); paraphrase, do not quote large chunks; one-sentence "explanation" tied to the material; "section" = a 3-6 word heading for that part of the material; "page" = the page number shown in brackets, or "" if unknown.',
          'Output STRICT JSON only: a single array of objects with keys question, options, answer, explanation, section, page. No markdown, no commentary.',
          '',
          'MATERIAL:',
          material,
        ].join('\n');
        try {
          const text = await callProvider(conf, user);
          questions.push(...parseQuestionJSON(text, ch, ci, S.gen.counts[ci] || 10));
          out.textContent = 'Generating... chapter ' + (ci + 1) + '/' + S.gen.chaps.length + ' done \u2014 ' + questions.length + ' questions so far';
        } catch (e2) { failure = e2; break; }
      }
      document.getElementById('gencancel').hidden = true;
      if (failure && !questions.length) {
        errBox.textContent = String(failure.message || failure).slice(0, 200);
        document.getElementById('genrun').hidden = false;
        return;
      }
      const bankId = 'b' + Date.now().toString(36);
      const banks = getBanks();
      banks[bankId] = { id: bankId, name, createdAt: Date.now(), questions, chapters: S.gen.chaps.map((c, i) => ({ id: i + 1, name: c.name })) };
      DB.putMeta('banks', banks);
      out.textContent = 'Done \u2014 ' + questions.length + ' questions across ' + S.gen.chaps.length + ' chapters. Switching to it...';
      await switchBank(bankId);
    }
    function parseQuestionJSON(text, ch, ci, count) {
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new Error('The reply contained no JSON array' + (text ? ' (' + text.slice(0, 40) + '\u2026)' : '.'));
      const arr = JSON.parse(m[0]);
      const out = [], seen = {};
      for (const o of (Array.isArray(arr) ? arr : [])) {
        if (!o || !Array.isArray(o.options) || o.options.length !== 4) continue;
        if (!o.question || typeof o.question !== 'string') continue;
        const key = o.question.toLowerCase().replace(/[^a-z0-9 ]+/g, '').slice(0, 60);
        if (seen[key]) continue; seen[key] = 1;
        const ans = Math.max(0, Math.min(3, +o.answer || 0));
        out.push({
          id: 'gen-' + ci + '-' + (out.length + 1),
          chapter: ci + 1, category: 'custom',
          question: o.question, options: o.options.map(x => String(x)),
          answer: ans, explanation: String(o.explanation || ''),
          source: { chapter: ci + 1, section: String(o.section || ch.name), anchor: '', page: String(o.page || ch.from || '') }
        });
        if (out.length >= count) break;
      }
      if (!out.length) throw new Error('The reply contained no usable questions.');
      return out;
    }
    async function callProvider(conf, user) {
      const sys = 'You write rigorous multiple-choice practice questions grounded in provided study material. Output STRICT JSON only \u2014 no prose, no markdown fences.';
      if (conf.provider === 'anthropic') {
        const r = await fetch((conf.base || 'https://api.anthropic.com/v1').replace(/\/+$/, '') + '/messages', { method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': conf.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: conf.model, max_tokens: 8000, system: sys, messages: [{ role: 'user', content: user }] }) });
        if (!r.ok) throw new Error('Anthropic ' + r.status + ' \u2014 ' + (await r.text()).slice(0, 120));
        const j = await r.json();
        return (j.content || []).map(c => c.text || '').join('');
      }
      if (conf.provider === 'gemini') {
        const r = await fetch((conf.base || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '') + '/models/' + encodeURIComponent(conf.model) + ':generateContent?key=' + encodeURIComponent(conf.key), { method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: 'user', parts: [{ text: user }] }] }) });
        if (!r.ok) throw new Error('Gemini ' + r.status + ' \u2014 ' + (await r.text()).slice(0, 120));
        const j = await r.json();
        const parts = (j.candidates || []).map(c => c.content).filter(Boolean).flatMap(c => (c.parts || []).map(p => p.text || ''));
        return parts.join('');
      }
      const r = await fetch((conf.base || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions', { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + conf.key },
        body: JSON.stringify({ model: conf.model, temperature: 0.3, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
      if (!r.ok) throw new Error('Provider ' + r.status + ' \u2014 ' + (await r.text()).slice(0, 120));
      const j = await r.json();
      return (j.choices || [])[0].message.content;
    }

  /* ------------------------------------------------ url routing: back/forward/refresh */
  function hashFor(mode, idx, done) {
    if (!mode || mode === 'idle') return '#home';
    return done ? '#results' : '#' + mode + '/' + (idx + 1);
  }
  function navReplace(hash) { if ((location.hash.slice(1) || 'home') !== hash.slice(1)) history.replaceState(null, '', hash); }
  function navPush(hash) { if ((location.hash.slice(1) || 'home') !== hash.slice(1)) history.pushState(null, '', hash); }
  window.addEventListener('popstate', () => {
    const h = location.hash.slice(1) || 'home';
    const m = h.match(/^(exam|chapter|review)\/(\d+)$/);
    if (!m) {
      if (h === 'results' && S.view && S.view.done) { showResults(); return; }
      if (S.view && S.view.mode && S.view.mode !== 'idle' && !S.view.done) parkRun('#home');
      gotoIdle();
      return;
    }
    const mode = m[1], k = Math.max(0, Math.min(parseInt(m[2], 10) - 1, S.view && S.view.queue ? S.view.queue.length - 1 : 0));
    if (S.view && S.view.mode === mode && !S.view.done) {
      S.view.idx = k; renderTop(); withTransition(renderQuestion); return;
    }
    if (S.stash && S.stash.mode === mode) {
      const v = S.stash; S.stash = null; S.view = v; saveCurrentProfile();
      S.view.idx = Math.min(k, S.view.queue.length - 1);
      if (S.view.mode === 'exam') startExamTimer();
      renderTop(); withTransition(renderQuestion); return;
    }
    gotoIdle();
  });

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
    for (let k = 0; k < n; k++) html += `<i class="${marks[k] === undefined ? 'todo' : (marks[k] === 'skip' ? 'qskip' : (marks[k] ? 'ok' : 'no'))}"></i>`;
    t.innerHTML = html;
    t.hidden = false;
    t.setAttribute('tabindex', '0');
    t.setAttribute('role', 'slider');
    t.setAttribute('aria-valuemin', '1');
    t.setAttribute('aria-valuemax', String(n));
    t.setAttribute('aria-valuenow', String(v.idx + 1));
    t.setAttribute('aria-valuetext', 'Question ' + (v.idx + 1) + ' of ' + n);
  }

  /* ------------------------------------------------ tally scrub: press, slide, release to jump */
  let scrubTarget = null, scrubTick = -1;
  let scrubBubbleEl = null;
  const hideScrubBubble = () => { if (scrubBubbleEl) { scrubBubbleEl.remove(); scrubBubbleEl = null; } };
  function showScrubBubble(x, y, k, jumpable) {
    if (!scrubBubbleEl) { scrubBubbleEl = document.createElement('div'); scrubBubbleEl.className = 'scrubbubble'; document.body.appendChild(scrubBubbleEl); }
    scrubBubbleEl.textContent = 'Q ' + (k + 1) + '/' + S.view.queue.length;
    scrubBubbleEl.classList.toggle('locked', !jumpable);
    const half = scrubBubbleEl.offsetWidth / 2;
    scrubBubbleEl.style.left = Math.min(Math.max(x, half + 4), innerWidth - half - 4) + 'px';
    scrubBubbleEl.style.top = y + 'px';
    scrubBubbleEl.style.transform = 'translate(-50%, -170%)';
  }
  function jumpableTo(v, k) { return v.mode === 'exam' || k < (v.tally || []).filter(x => x === true || x === false).length; }
  function tickUnder(tally, x, y) {
    let best = -1, bd = Infinity;
    for (let k = 0; k < tally.children.length; k++) {
      const r = tally.children[k].getBoundingClientRect();
      const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    return bd === Infinity ? -1 : best;
  }
  function paintScrub(tally, k) {
    if (tally) [...tally.children].forEach((i, ik) => i.classList.toggle('scrub', ik === k));
  }
  document.addEventListener('pointerdown', e => {
    const tally = e.target.closest && e.target.closest('#tally');
    if (!tally) return;
    const v = S.view; if (!v || !v.queue) return;
    scrubTarget = { tally, id: e.pointerId };
    try { tally.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    tickUnder(tally, e.clientX, e.clientY);
    paintScrub(tally, scrubTick = Math.max(tickUnder(tally, e.clientX, e.clientY), 0));
    showScrubBubble(e.clientX, e.clientY, scrubTick, jumpableTo(v, scrubTick));
  });
  document.addEventListener('pointermove', e => {
    if (!scrubTarget || e.pointerId !== scrubTarget.id) return;
    e.preventDefault();
    const { tally } = scrubTarget, v = S.view;
    const k = Math.max(tickUnder(tally, e.clientX, e.clientY), 0);
    if (k !== scrubTick) { scrubTick = k; paintScrub(tally, k); }
    showScrubBubble(e.clientX, e.clientY, scrubTick, jumpableTo(v, scrubTick));
  });
  function endScrub(e) {
    if (!scrubTarget || e.pointerId !== scrubTarget.id) return;
    const { tally } = scrubTarget, v = S.view, k = scrubTick;
    paintScrub(tally, -1); hideScrubBubble();
    scrubTick = -1; scrubTarget = null;
    if (k >= 0 && jumpableTo(v, k) && k !== v.idx) gotoQuestion(k);
  }
  document.addEventListener('pointerup', endScrub);
  document.addEventListener('pointercancel', endScrub);
  document.addEventListener('keydown', e => {
    const tally = e.target.closest && e.target.closest('#tally');
    if (!tally) return;
    const v = S.view; if (!v || !v.queue) return;
    const n = v.queue.length;
    let handled = true;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') scrubTick = Math.min(n - 1, (scrubTick < 0 ? v.idx : scrubTick) + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') scrubTick = Math.max(0, (scrubTick < 0 ? v.idx : scrubTick) - 1);
    else if (e.key === 'Home') scrubTick = 0;
    else if (e.key === 'End') scrubTick = n - 1;
    else if ((e.key === 'Enter' || e.key === ' ') && scrubTick >= 0) {
      paintScrub(tally, -1); const k = scrubTick; scrubTick = -1;
      t.setAttribute('aria-valuenow', String(v.idx + 1));
      if (jumpableTo(v, k) && k !== v.idx) gotoQuestion(k);
      return;
    } else handled = false;
    if (handled) {
      e.preventDefault();
      paintScrub(tally, scrubTick);
      t.setAttribute('aria-valuenow', String(scrubTick + 1));
      t.setAttribute('aria-valuetext', 'Question ' + (scrubTick + 1) + ' of ' + n);
    }
  });

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
    pingAnswered(q.id);
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
    }
    renderTop();
    renderTally();

    $('#fb').innerHTML = fb + flagHtml(q);
    const vr = document.getElementById('votereport');
    if (vr) {
      vr.onclick = () => {
        vr.disabled = true;
        sendReportVote(q.id, 'down').then(function (res) {
          const sig = mergeSignal(q.id, res || {});
          vr.textContent = '👎 Reported';
          vr.classList.add('on');
          refreshSignalChips(q.id, sig);
          // practice/review: ask why right away; exam defers it to the results
          if (S.view.mode === 'exam') {
            S.view.examReports = S.view.examReports || [];
            if (!S.view.examReports.includes(q.id)) S.view.examReports.push(q.id);
            syncStash();
          } else openReasonPanel(q);
        }).catch(function () { vr.disabled = false; vr.textContent = 'offline'; });
      };
    }
    reportSignal(S.activeBank || 'default', q.id).then(function (sig) {
      refreshSignalChips(q.id, mergeSignal(q.id, sig));
    }).catch(() => {});
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
    if (!q.source.anchor) return `<span class="src">Source: your PDF — ${esc(q.source.section || 'section')}${q.source.page ? ', page ' + esc(q.source.page) : ''}</span>`;
    const href = './drivers-guide-2026.md' + q.source.anchor;
    return `<span class="src">Source: <a href="${href}" target="_blank">Chapter ${q.source.chapter} → ${esc(q.source.section)}</a></span>`;
  }
  function chapterName(c) { const ch = S.chapters.find(x => x.id === c); return ch ? ch.name : ''; }
  function flagHtml(q) {
    const label = sigLabel((window.SIGNAL_CACHE || {})[q.id] || {});
    const signal = label ? ` · <span class="cvsig">${esc(label)}</span>` : '';
    return `<div class="votebar"><button class="setbtn" id="votereport" title="Report this question as bad or wrong">👎 Report</button>${signal}</div>`;
  }

  /* downvote reason panel ------------------------------------------------- */
  const REASON_CHIPS = ['Wrong answer', 'Misleading wording', 'Not in the guide', 'Outdated', 'Other'];
  // in-page panel asking why a question was downvoted. The vote itself is
  // already recorded: Send attaches the reason, Skip keeps the bare vote.
  function openReasonPanel(q, opts) {
    closeReasonPanel();
    const wrap = document.createElement('div');
    wrap.id = 'rpwrap';
    wrap.innerHTML = `<div class="card rpanel" role="dialog" aria-modal="true" aria-label="Why are you reporting this question?">
      <div class="rptitle">What's wrong with this question?</div>
      ${opts && opts.banner ? `<div class="rpbanner">${esc(opts.banner)}</div>` : ''}
      <div class="rpq">${esc(q.question)}</div>
      <div class="rpchips">${REASON_CHIPS.map(r => `<button class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <textarea class="rpnote" id="rpnote" maxlength="500" placeholder="Optional detail (max 500 characters)\u2026"></textarea>
      <div class="rpmsg" id="rpmsg"></div>
      <div class="nextrow"><button class="btn ghost" id="rpskip">Skip</button><button class="btn" id="rpsend">Send reason</button></div>
    </div>`;
    document.body.appendChild(wrap);
    let tag = '';
    const chips = wrap.querySelectorAll('.rpchips .chip');
    chips.forEach(c => c.onclick = () => {
      const on = c.classList.toggle('on');
      if (on) tag = c.dataset.r;
      chips.forEach(o => { if (o !== c) o.classList.remove('on'); });
    });
    wrap.querySelector('#rpsend').onclick = () => {
      const note = wrap.querySelector('#rpnote').value.trim().slice(0, 500);
      const send = wrap.querySelector('#rpsend');
      send.disabled = true;
      sendReportVote(q.id, 'down', note ? (tag ? tag + ' \u2014 ' + note : note) : tag).then(function () {
        closeReasonPanel();
        if (opts && opts.onDone) opts.onDone();
      }).catch(function () {
        send.disabled = false;
        wrap.querySelector('#rpmsg').textContent = 'Could not send \u2014 try again';
      });
    };
    wrap.querySelector('#rpskip').onclick = () => { closeReasonPanel(); if (opts && opts.onDone) opts.onDone(); };
    wrap.querySelector('#rpnote').focus();
  }
  function closeReasonPanel() { const w = document.getElementById('rpwrap'); if (w) w.remove(); }
  // exam results: one reason prompt per downvoted question, in order; sent or
  // skipped rows are remembered so re-showing the results does not re-ask
  function promptExamReports() {
    const v = S.view;
    const sent = v.examReportSent = v.examReportSent || {};
    const next = (v.examReports || []).find(id => !sent[id] && S.byId.get(id));
    if (!next) return;
    openReasonPanel(S.byId.get(next), {
      banner: 'You reported ' + v.examReports.length + ' question' + (v.examReports.length === 1 ? '' : 's') + ' during this exam',
      onDone: function () { sent[next] = true; setTimeout(promptExamReports, 400); },
    });
  }

  /* ------------------------------------------------ summaries */
  function showChapterSummary() {
    const v = S.view;
    v.done = true;
    S.stash = null;
    saveCurrentProfile();
    navPush(hashFor(v.mode, v.idx, true));
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
    S.stash = null;
    saveCurrentProfile();
    navPush(hashFor(v.mode, v.idx, v.done));
    const pct = v.queue.length ? Math.round(v.correct / v.queue.length * 100) : 0;
    const pass = pct / 100 >= S.settings.passMark;
    const session = { mode: 'exam', date: new Date().toISOString(), score: pct, correct: v.correct, total: v.queue.length, passed: pass, seconds: S.settings.examMinutes * 60 - Date.now() / 1000 };
    session.seconds = Math.round(session.seconds);
    DB.addSession(session).then(() => { S.sessions.push(session); renderTop(); });
    renderTop();
    const skipped = v.queue.filter(id => !v.answers[id]);
    skipped.forEach(id => { const r = rec(id); if (r.status === 'unseen') { r.status = 'review'; persist(id); } });
    const missed = v.queue.map(id => ({ q: S.byId.get(id), a: v.answers[id] })).filter(x => !x.a || !x.a.correct);
    const lines = S.chapters.map(c => {
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
    // downvotes queued during the exam get their reason prompts here
    if (v.examReports && v.examReports.length) promptExamReports();
  }
})();
