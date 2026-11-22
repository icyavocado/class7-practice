// Core e2e flows for the practice app: home render, chapter test, answer
// marking, the answered-question lock, wrong-answer -> review, exam timer.
// Helpers wipe IndexedDB on every page.goto('/'), so tests that must keep
// their progress (review mode) navigate in-page instead of reloading.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

test.describe('core flows', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  // "Licensing & GDL 1/70" -> { name: 'Licensing & GDL', idx: 1, total: 70 }
  async function readTag(page) {
    const txt = (await page.locator('#zone .tag').innerText()).trim();
    const m = txt.match(/^(.*) (\d+)\/(\d+)$/);
    return m && { name: m[1], idx: +m[2], total: +m[3] };
  }

  // Open the first chapter pill and land on its first question.
  async function openFirstChapter(page) {
    await gotoHome(page);
    const pill = page.locator('#chapters button').first();
    await test.expect(pill).toBeVisible();
    await pill.click();
    await test.expect(page.locator('#zone .tag')).toBeVisible();
    const tag = await readTag(page);
    const total = tag ? tag.total : null;
    const name = tag ? tag.name : null;
    return { total, name };
  }

  test('home renders three modes and ten chapter pills', async () => {
    const { page } = await newPage(browser);
    await gotoHome(page);
    const idle = page.locator('.idle');
    await test.expect(idle).toBeVisible();
    await test.expect(page).toHaveTitle(/Alberta Class 7/);        // booted, not crashed
    await test.expect(page.locator('#chapters button')).toHaveCount(10);
    for (const id of ['#m-exam', '#m-ch', '#m-review']) {
      await test.expect(page.locator(id)).toBeVisible();
    }
    // the first pill is chapter 1, still unpractised ("0%", red = weak)
    await test.expect(page.locator('#chapters button').first()).toContainText('Licensing');
    await test.expect(page.locator('#chapters button .pctp').first()).toHaveText('0%');
  });

  test('chapter test: answering advances the counter and shows feedback', async () => {
    const { page } = await newPage(browser);
    const { name, total } = await openFirstChapter(page);
    const tag = page.locator('#zone .tag');
    await test.expect(tag).toHaveText(`${name} 1/${total}`);
    await test.expect(page.locator('#tally i').first()).toHaveClass(/todo/);

    await page.locator('#zone .opt').first().click();              // option A
    await test.expect(page.locator('#fb')).not.toHaveText('');     // feedback shown
    await test.expect(page.locator('#fb .feedback')).toBeVisible();
    await test.expect(page.locator('#tally i').first()).toHaveClass(/^(ok|no)$/);
    await test.expect(page.locator('#progcount')).toHaveText(/^(1 \/ 0|0 \/ 1)$/);
    await test.expect(page.locator('#nextbtn')).toBeVisible();

    await page.locator('#nextbtn').click();                        // next question arrives
    await test.expect(tag).toHaveText(`${name} 2/${total}`);
    await test.expect(page.locator('#fb')).toHaveText('');
  });

  test('answer marking reveals exactly one correct option', async () => {
    const { page } = await newPage(browser);
    await openFirstChapter(page);
    const picked = page.locator('#zone .opt').first();             // option A
    await picked.click();

    // Exactly one option is revealed as the correct answer; the picked option
    // is marked right (when it was correct) or wrong (when it was not).
    await test.expect(page.locator('#zone .opt.right')).toHaveCount(1);
    const cls = await picked.getAttribute('class');
    test.expect(cls).toMatch(/(right|wrong)/);
  });

  test('answered questions stay locked after Back', async () => {
    const { page } = await newPage(browser);
    const { name, total } = await openFirstChapter(page);
    const tag = page.locator('#zone .tag');

    await page.locator('#zone .opt').first().click();              // answer Q1
    await page.locator('#nextbtn').click();
    await test.expect(tag).toHaveText(`${name} 2/${total}`);
    await test.expect(page.locator('#backbtn')).toBeVisible();

    await page.locator('#backbtn').click();                        // revisit Q1
    await test.expect(tag).toHaveText(`${name} 1/${total}`);
    const opts = page.locator('#zone .opt');
    await test.expect(opts).toHaveCount(4);
    for (let i = 0; i < 4; i++) await test.expect(opts.nth(i)).toBeDisabled();
    await test.expect(page.locator('#fb')).toHaveText('');          // no fresh feedback on revisit
  });

  test('wrong answer sends the question to review mode', async () => {
    const { page } = await newPage(browser);
    const { name, total } = await openFirstChapter(page);
    const tag = page.locator('#zone .tag');

    // Answer with option D until one of them is wrong (10 of 70 chapter-1
    // questions have D as the correct answer). Cap the loop so the test
    // always terminates; Review (1+) is only reachable through a wrong pick.
    for (let k = 1; k <= 6; k++) {
      await page.locator('#zone .opt[data-i="3"]').click();
      await test.expect(page.locator('#fb .feedback')).toBeVisible();
      const fb = await page.locator('#fb').innerText();
      if (/wrong|reset/i.test(fb)) break;
      if (k < 6) {
        await page.locator('#nextbtn').click();
        await test.expect(tag).toHaveText(`${name} ${k + 1}/${total}`);
      }
    }

    // Park the live run and go home — in-page, goto('/') would wipe IndexedDB.
    await page.locator('#topstats [data-act="skip"]').click();
    await test.expect(page.locator('.idle')).toBeVisible();
    const review = page.locator('#m-review');
    await test.expect(review).toBeEnabled();
    await test.expect(review.locator('b')).toHaveText(/^Review \(([1-9]\d*)\)$/);
  });

  test('exam starts with 30 questions and a ticking timer', async () => {
    const { page } = await newPage(browser);
    await gotoHome(page);
    await page.locator('#m-exam').click();
    const tag = page.locator('#zone .tag');
    await test.expect(tag).toHaveText('Exam 1/30');
    const timer = page.locator('#timer');
    await test.expect(timer).toHaveText(/\d\d:\d\d/);
    const before = await timer.innerText();
    await test.expect(timer).not.toHaveText(before, { timeout: 2500 });  // strictly decreases
    const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
    test.expect(secs(await timer.innerText())).toBeLessThan(secs(before));
    await test.expect(timer).toHaveText(/\d\d:\d\d/);
  });
});
