// e2e — exam timer + topbar engagement ring. Regression for two user-reported
// bugs: (1) the countdown froze forever after a park (skip / tab switch) left
// the question on screen without its interval; (2) the ring showed only
// mastery while exam answers are engagement.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

const toSec = s => { const [m, sec] = s.split(':').map(Number); return m * 60 + sec; };  // mmss -> seconds
const mmss = s => toSec(s);   // used by the single-tick assertion

async function startExam(page) {
  await page.click('#m-exam');
  await page.waitForSelector('.run');
  await page.waitForSelector('#timer', { timeout: 5000 });
}

test.describe('exam timer + engagement ring', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  test('countdown runs, pauses while hidden, resumes when visible', async () => {
    const { page, ctx } = await newPage(browser);
    await gotoHome(page);
    await startExam(page);
    const t0 = await page.textContent('#timer');
    await page.waitForTimeout(1450);
    const t1 = await page.textContent('#timer');
    test.expect(t1).not.toBe(t0);                       // counting

    // switching away: the app parks; the question stays but the clock pauses
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const t2 = await page.textContent('#timer');
    await page.waitForTimeout(1300);
    test.expect(await page.textContent('#timer')).toBe(t2);   // frozen while hidden

    // coming back: the countdown resumes in place
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1450);
    test.expect(await page.textContent('#timer')).not.toBe(t2);  // counting again
    await ctx.close();
  });

  test('skip parks the run and resuming restarts the countdown', async () => {
    const { page, ctx } = await newPage(browser);
    await gotoHome(page);
    await startExam(page);
    await page.waitForTimeout(1200);
    await page.click('[data-act="skip"]');                // park
    await page.waitForSelector('.idle');
    await page.click('[data-act="resume"]');              // resume: same question, clock goes again
    await page.waitForSelector('#timer', { timeout: 5000 });
    const a = await page.textContent('#timer');
    await page.waitForTimeout(1450);
    test.expect(await page.textContent('#timer')).not.toBe(a);
    // no stacked intervals: the countdown steps at most one second per sample
    const steps = [a];
    for (let i = 0; i < 4; i++) { steps.push(await page.textContent('#timer')); await page.waitForTimeout(900); }
    const distinct = new Set(steps).size;
    test.expect(distinct).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < steps.length; i++) {
      const drop = toSec(steps[i - 1]) - toSec(steps[i]);
      test.expect(drop).toBeLessThanOrEqual(1);           // single tick rate, never double
      test.expect(drop).toBeGreaterThanOrEqual(0);
    }
    await ctx.close();
  });

  test('exam answers bump the engagement ring regardless of correctness', async () => {
    const { page, ctx } = await newPage(browser);
    await gotoHome(page);
    await startExam(page);
    test.expect(await page.textContent('#ringn')).toBe('0');
    await page.click('.opt[data-i="0"]');                 // answer 1 (both outcomes engage)
    await page.waitForTimeout(250);
    const ring1 = await page.textContent('#ringn');
    test.expect(ring1).toBe('1');
    await page.click('#nextbtn');
    await page.click('.opt[data-i="0"]');                 // answer 2
    await page.waitForTimeout(250);
    test.expect(await page.textContent('#ringn')).toBe('2');
    await ctx.close();
  });
});
