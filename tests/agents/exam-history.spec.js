// e2e — exam flow + navigation/history (tests/agents/exam-history.spec.js)
// Covers: skip marking on Next, answered-tick stability, back-to-answer overwrite,
// pushState/popstate navigation, mid-exam refresh restore, and the all-skip finish.
//
// NOTE on test 5: newPage() installs an init-script that deletes the app's
// IndexedDB on EVERY document load — including page.reload() — so the stash the
// app parks on pagehide is destroyed before boot can restore it. The app
// genuinely restores (verified against a plain reload), so that test runs in a
// plain fresh context: a new Playwright context starts with empty storage by
// construction, so it is just as deterministic as newPage()'s wiped contexts.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

// Start an exam from the idle home view. Tag reads "Exam 1/30" on the render.
async function startExam(page) {
  await page.click('#m-exam');
  await test.expect(page.locator('.tag')).toHaveText('Exam 1/30');
}

// Advance one question via Next; the tag text confirms the new index settled.
async function nextTo(page, k) {
  await page.locator('#nextbtn').click();
  await test.expect(page.locator('.tag')).toHaveText('Exam ' + k + '/30');
}

// Answer the current question by picking the first option.
async function answerFirst(page) {
  await page.locator('.opt').first().click();
}

// Tally tick classes in queue order: 'todo' | 'qskip' | 'ok' | 'no'.
function tallyClasses(page) {
  return page.$$eval('#tally i', els => els.map(e => e.className));
}

// Wait until the timer leaves its initial value (it decrements once per second).
async function timerTicked(page) {
  const t0 = await page.textContent('#timer');
  await page.waitForFunction(
    t => document.getElementById('timer') && document.getElementById('timer').textContent !== t,
    t0, { timeout: 8000 }
  );
}

test.describe('Exam + history', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  test('exam: Next without answering marks 5 ticks qskip and shows Exam 6/30', async () => {
    const { page, ctx } = await newPage(browser);
    const expect = test.expect;
    await gotoHome(page);
    await startExam(page);
    await timerTicked(page);                       // live countdown is running
    for (let k = 2; k <= 6; k++) await nextTo(page, k);
    const cls = await tallyClasses(page);
    expect(cls).toHaveLength(30);
    expect(cls.slice(0, 5)).toEqual(['qskip', 'qskip', 'qskip', 'qskip', 'qskip']);
    expect(cls.slice(5)).toEqual(Array(25).fill('todo'));
    await expect(page.locator('#timer')).toBeVisible();
    await ctx.close();
  });

  test('exam: an answered tick never flips to qskip while advancing past it', async () => {
    const { page, ctx } = await newPage(browser);
    const expect = test.expect;
    await gotoHome(page);
    await startExam(page);
    await answerFirst(page);                       // q1 → tick ok|no
    let cls = await tallyClasses(page);
    expect(['ok', 'no']).toContain(cls[0]);
    await nextTo(page, 2);                         // Next on the ANSWERED q1 (the old bug trigger)
    cls = await tallyClasses(page);
    expect(['ok', 'no']).toContain(cls[0]);
    await nextTo(page, 3);                         // q2 skipped
    await nextTo(page, 4);                         // q3 skipped
    await nextTo(page, 5);                         // q4 skipped
    cls = await tallyClasses(page);
    expect(['ok', 'no']).toContain(cls[0]);        // still intact after three skip-advances
    expect(cls.slice(1, 4)).toEqual(['qskip', 'qskip', 'qskip']);
    expect(cls.slice(4)).toEqual(Array(26).fill('todo'));
    await ctx.close();
  });

  test('exam: back to a skipped question keeps it answerable and the answer overwrites the skip', async () => {
    const { page, ctx } = await newPage(browser);
    const expect = test.expect;
    await gotoHome(page);
    await startExam(page);
    await nextTo(page, 2);                         // q1 skipped
    await expect(page.locator('#backbtn')).toBeVisible();
    await page.locator('#backbtn').click();
    await expect(page.locator('.tag')).toHaveText('Exam 1/30');
    const opts = page.locator('.opt');
    await expect(opts.first()).toBeEnabled();      // still answerable after being skipped
    await opts.nth(1).click();
    let cls = await tallyClasses(page);
    expect(['ok', 'no']).toContain(cls[0]);        // skip mark overwritten by the answer
    await nextTo(page, 2);                         // advancing again must not restore qskip
    cls = await tallyClasses(page);
    expect(['ok', 'no']).toContain(cls[0]);
    await ctx.close();
  });

  test('history: Next pushes question hashes and browser Back/Forward move between questions', async () => {
    const { page, ctx } = await newPage(browser);
    const expect = test.expect;
    await gotoHome(page);
    await startExam(page);                         // #exam/1
    await answerFirst(page);
    await nextTo(page, 2);                         // q2 skipped → #exam/2
    await nextTo(page, 3);                         // q3 skipped → #exam/3
    await nextTo(page, 4);                         // q4 current → #exam/4
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#exam/3');
    await expect(page.locator('.tag')).toHaveText('Exam 3/30', { timeout: 8000 });
    await page.goForward();
    await page.waitForFunction(() => location.hash === '#exam/4');
    await expect(page.locator('.tag')).toHaveText('Exam 4/30', { timeout: 8000 });
    const cls = await tallyClasses(page);
    expect(['ok', 'no']).toContain(cls[0]);        // runs survived the round trip
    expect(cls.slice(1, 3)).toEqual(['qskip', 'qskip']);
    expect(cls[3]).toBe('todo');
    await ctx.close();
  });

  test('history: refresh mid-exam restores the parked run at the same question with the tally intact', async () => {
    const ctx = await browser.newContext();        // plain context — see the header note
    const page = await ctx.newPage();
    const expect = test.expect;
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    await gotoHome(page);
    await startExam(page);
    await answerFirst(page);                       // q1 → ok|no
    await nextTo(page, 2);                         // q2 skipped → #exam/2
    await nextTo(page, 3);                         // park point → #exam/3
    const clsBefore = await tallyClasses(page);
    expect(clsBefore).toHaveLength(30);
    expect(['ok', 'no']).toContain(clsBefore[0]);
    expect(clsBefore[1]).toBe('qskip');
    await page.reload();
    await page.waitForFunction(() => location.hash === '#exam/3');
    await expect(page.locator('.tag')).toHaveText('Exam 3/30', { timeout: 8000 });
    const clsAfter = await tallyClasses(page);
    expect(clsAfter).toEqual(clsBefore);           // tally restored in full, same order
    await expect(page.locator('#timer')).toBeVisible();
    await expect(page.locator('#topstats')).toContainText('Skip');   // restored as a live run
    await expect(page.locator('.opt').first()).toBeEnabled();
    expect(pageErrors).toEqual([]);                // no crash during the restore path
    await ctx.close();
  });

  test('exam: finishing an all-skipped exam shows 0% FAIL with a full skip count', async () => {
    const { page, ctx } = await newPage(browser);
    const expect = test.expect;
    await gotoHome(page);
    await startExam(page);
    for (let k = 2; k <= 30; k++) await nextTo(page, k);   // skip q1..q29
    const cls = await tallyClasses(page);
    expect(cls.slice(0, 29)).toEqual(Array(29).fill('qskip'));
    expect(cls[29]).toBe('todo');
    await expect(page.locator('#nextbtn')).toBeHidden();   // last question: Next gives way
    await page.locator('#finishbtn').click();
    const results = page.locator('section.results');
    await expect(results).toBeVisible();
    await expect(results.locator('.score')).toHaveText('0%');
    await expect(results.locator('.scoreline')).toContainText('FAIL');
    await expect(results).toContainText('skipped 30');     // ≥ 29 skipped (here: all 30)
    await expect(results.locator('.chaptersum .crow').first()).toBeVisible();
    await ctx.close();
  });
});
