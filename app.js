/* app.js — Alberta Class 7 Practice 2026
   One page, one viewport: chapter-confidence strip + question zone.
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
    return Promise.all([DB.getAllState(), DB.getSessions(), DB.getMeta('settings')]);
  }).then(([states, sessions, settings]) => {
    (states || []).forEach(r => S.P.set(r.qid, r));
    S.sessions = sessions || [];
    if (settings) Object.assign(S.settings, settings);
    applyAppearance(S.settings.appearance || localStorage.getItem('appearance') || 'system');
    withTransition(gotoIdle);
  });

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

  function renderStrip() {
    let weak = null;
    const rows = CHAPTERS.map(ch => {
      const st = chapterStats(ch.id);
      if (!st.total) return `<span class="chip empty" aria-disabled="true" title="No questions in this chapter yet">
        <span class="cname">${esc(ch.name)}</span> <span class="crate">—</span>
        <span class="bar"><i style="width:0%"></i></span></span>`;
      let cls = '';
      if (st.pct < 0.4) { cls = 'weak'; weak = weak === null ? ch : weak; }
      else if (st.pct < 0.7) cls = 'warn';
      const pct = Math.round(st.pct * 100);
      return `<button class="chip ${cls}" data-ch="${ch.id}" title="Practice ${esc(ch.name)}">
        <span class="cname">${esc(ch.name)}</span> <span class="crate">${pct}%</span>
        <span class="bar"><i style="width:${pct}%"></i></span></button>`;
    }).join('');
    const activeRun = S.view && S.view.mode && S.view.mode !== 'idle' && !S.view.done;
    const compact = matchMedia('(max-width: 480px)').matches;
    const skipLbl = activeRun ? (S.view.mode === 'exam' ? (compact ? 'Skip' : 'Skip test') : (compact ? 'Skip' : 'Skip practice')) : null;
    const resumeLbl = S.stash ? (S.stash.mode === 'exam' ? (compact ? 'Resume' : 'Resume test') : (compact ? 'Resume' : 'Resume practice')) : null;
    const stripInner = $('#strip-inner');
    const scrollLeft = stripInner.scrollLeft;          // keep the user's horizontal position on re-renders
    stripInner.innerHTML = rows +
      `<button class="chip drill" data-act="weakest"><span class="cname">Drill weakest</span><span class="bar"><i style="width:100%"></i></span></button>`;
    stripInner.scrollLeft = scrollLeft;
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
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.act === 'weakest') { startWeakest(); return; }
    const ch = +chip.dataset.ch;
    if (ch) startChapter(ch);
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
  function handleReset() {
    if (!resetArmed) {
      resetArmed = true; paintReset();
      resetTimer = setTimeout(() => { resetArmed = false; paintReset(); }, 4000);
      return;
    }
    clearTimeout(resetTimer); resetArmed = false;
    DB.reset().then(() => { S.P.clear(); S.sessions = []; S.stash = null; gotoIdle(); });
  }

  function zone(html) { $('#zone').innerHTML = html; }

  function gotoIdle() {
    if (S.view && S.view.timer) clearInterval(S.view.timer);
    S.view = { mode: 'idle' }; document.title = 'Alberta Class 7 Practice 2026';
    renderStrip();
    const weakCh = weakestChapter();
    const reviewCount = countReview();
    zone(`<section class="card wrap idle" aria-label="Overview">
      <h1>Practice for your Class 7 knowledge test</h1>
      <div class="muted">Right answers raise the chapter confidence. Miss a mastered question and it drops back to review, so weak chapters surface.</div>
      <div class="modegrid">
        <button class="modecard" id="m-exam"><b>Exam simulation</b><span class="desc">${S.settings.examLen} random questions, ${S.settings.examMinutes} minute soft timer, pass at ${Math.round(S.settings.passMark * 100)}%.</span></button>
        <button class="modecard" id="m-ch"><b>Chapter test</b><span class="desc">Instant feedback with explanations and guide citations.</span></button>
        <button class="modecard" id="m-review" ${reviewCount ? '' : 'disabled'}><b>Review (${reviewCount})</b><span class="desc">Repeated practice on missed and flagged questions.</span></button>
      </div>
      <div class="muted" style="margin-bottom:2px">Pick a chapter to practice:</div>
      <div id="chapters">${CHAPTERS.map(c => `<button data-chapter="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="muted">Weakest chapter${weakCh ? ': <b>' + esc(weakCh.name) + '</b>' : ': answer more questions to reveal it'}.</div>
    </section>`);
    $('#m-exam').onclick = startExam;
    $('#m-ch').onclick = () => startChapterWeakestOr2();
    $('#m-review').onclick = startReview;
    $('#chapters').onclick = e => { const b = e.target.closest('button[data-chapter]'); if (b) startChapter(+b.dataset.chapter); };
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
  function startWeakest() { const w = weakestChapter(); if (w) startChapter(w.id); }

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
    const answered = !!(v.tally && v.tally[v.idx] !== undefined);
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
      nb2.onclick = () => { v.idx++; withTransition(renderQuestion); };
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
    renderStrip();
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
    renderStrip();
    withTransition(renderQuestion);
  }
  const isReview = v => v.mode === 'review';

  /* ------------------------------------------------ answering */
  function renderTally() {
    const t = document.getElementById('tally'); if (!t) return;
    const v = S.view; if (!v || !v.queue) return;
    const n = v.queue.length, marks = v.tally || [];
    let html = '';
    for (let k = 0; k < n; k++) html += `<i class="${marks[k] === undefined ? 'todo' : (marks[k] ? 'ok' : 'no')}"></i>`;
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
      renderStrip();
      renderTally();
      const chipEl = document.querySelector(`.chip[data-ch="${q.chapter}"]`);
      if (chipEl && !noMotion.matches) { chipEl.classList.add('tick'); setTimeout(() => chipEl.classList.remove('tick'), 650); }
    }

    $('#fb').innerHTML = fb;
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

  /* ------------------------------------------------ summaries */
  function showChapterSummary() {
    const v = S.view;
    v.done = true;
    renderStrip();
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
    DB.addSession(session).then(() => { S.sessions.push(session); renderStrip(); });
    renderStrip();
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
