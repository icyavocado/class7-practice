// e2e — the community report queue v2 (Supabase-backed).
// No upvote box: answering counts as an "answered" ping (once per device per
// question), the bar holds ONE downvote button, and the reason panel pops up
// right away in practice — or at the results screen for exam-queued reports.
// Endpoints are mocked via page.route (takes precedence over the helpers'
// context-level defaults); POST payloads and chips are asserted.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

test.describe('community reports', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  // fresh signal GET each render; the POST mock counts answered pings and
  // reports so the chip always reads back server truth
  async function mock(page, posts) {
    let answered = 41, reports = 0;
    await page.route('**/rest/v1/question_signal**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ up: 0, down: 0, answers: answered }]),
    }));
    await page.route('**/functions/v1/report-vote**', route => {
      posts.push(route.request().postDataJSON());
      const vote = posts[posts.length - 1].vote;
      if (vote === 'answered') answered++;
      if (vote === 'down') reports++;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, up: 0, down: reports, answers: answered, recorded: vote }),
      });
    });
    // the GET runs at render time and would race the ping — read the mock's
    // current values through a mutable closure instead: simplest is a fixed
    // initial read; the chip updates come from the POST responses.
  }

  test('answer pings once, downvote pops the panel, send posts the reason', async () => {
    const { page, ctx } = await newPage(browser);
    const posts = [];
    await mock(page, posts);

    await gotoHome(page);
    await page.click('#chapters button[data-chapter="1"]');
    await page.waitForSelector('.run');
    await page.click('.opt[data-i="0"]');                        // answer
    await test.expect.poll(() => posts.map(p => p.vote).join()).toBe('answered');
    const qid = posts[0].qid;
    test.expect(posts[0].bank_id).toBe('default');
    test.expect(posts[0].device_id).toMatch(/^dv-/);
    test.expect(Number.isInteger(posts[0].picked)).toBe(true);        // outcome: option index
    test.expect(typeof posts[0].correct).toBe('boolean');
    await test.expect(page.locator('#fb .cvsig')).toContainText('42 answered', { timeout: 5000 });
    // no upvote box, no GitHub details link — one downvote button + chip
    await test.expect(page.locator('#votegood')).toHaveCount(0);
    await test.expect(page.locator('#flagq')).toHaveCount(0);
    await test.expect(page.locator('#fb .votebar')).toContainText('Report');

    await page.click('#votereport');                             // downvote
    await test.expect(page.locator('#rpwrap')).toBeVisible({ timeout: 5000 });
    await test.expect(page.locator('#fb .cvsig')).toContainText('1 report');
    await test.expect(page.locator('#votereport')).toContainText('Reported');
    await test.expect(page.locator('#votereport')).toBeDisabled();

    await page.click('.rpchips .chip:has-text("Wrong answer")');
    await page.fill('#rpnote', 'the answer key is wrong');
    await page.click('#rpsend');
    await test.expect(page.locator('#rpwrap')).toHaveCount(0);
    await test.expect.poll(() => posts.length).toBe(3);
    test.expect(posts[1].vote).toBe('down');
    test.expect(posts[1].reason).toBeUndefined();
    test.expect(posts[2].vote).toBe('down');
    test.expect(posts[2].qid).toBe(qid);
    test.expect(posts[2].reason).toContain('Wrong answer');
    test.expect(posts[2].reason).toContain('answer key is wrong');
    await ctx.close();
  });

  test('skip keeps the recorded vote without a reason', async () => {
    const { page, ctx } = await newPage(browser);
    const posts = [];
    await mock(page, posts);

    await gotoHome(page);
    await page.click('#chapters button[data-chapter="1"]');
    await page.waitForSelector('.run');
    await page.click('.opt[data-i="0"]');
    await test.expect.poll(() => posts.map(p => p.vote).join()).toBe('answered');

    await page.click('#votereport');
    await test.expect(page.locator('#rpwrap')).toBeVisible({ timeout: 5000 });
    await page.click('#rpskip');
    await test.expect(page.locator('#rpwrap')).toHaveCount(0);
    await test.expect.poll(() => posts.length).toBe(2);
    test.expect(posts[1].vote).toBe('down');
    test.expect(posts[1].reason).toBeUndefined();
    await test.expect(page.locator('#votereport')).toBeDisabled();
    await test.expect(page.locator('#fb .cvsig')).toContainText('1 report');
    await ctx.close();
  });

  test('exam downvotes queue silently and are asked for at the results screen', async () => {
    const { page, ctx } = await newPage(browser);
    const posts = [];
    await mock(page, posts);

    await gotoHome(page);
    await page.click('#m-exam');
    await page.waitForSelector('.run');
    await page.click('.opt[data-i="0"]');                        // answer exam q1
    await test.expect.poll(() => posts.map(p => p.vote).join()).toBe('answered');

    await page.click('#votereport');                             // queue the report
    await test.expect(page.locator('#rpwrap')).toHaveCount(0);   // no popup here
    await test.expect(page.locator('#votereport')).toContainText('Reported');
    await test.expect.poll(() => posts.map(p => p.vote).join()).toContain('down');

    // drive the remaining exam questions (30 total): answer + next
    for (let i = 1; i < 30; i++) {
      await page.click('#nextbtn');
      await page.click('.opt[data-i="0"]');
    }
    await test.expect(page.locator('#finishbtn')).toBeVisible();
    await page.click('#finishbtn');
    await page.waitForSelector('#resulthead');

    // the results screen pops the reason panel for the queued report
    await test.expect(page.locator('#rpwrap')).toBeVisible({ timeout: 5000 });
    await test.expect(page.locator('.rpbanner')).toContainText('reported 1 question during this exam');
    await page.click('.rpchips .chip:has-text("Outdated")');
    await page.click('#rpsend');
    await test.expect(page.locator('#rpwrap')).toHaveCount(0);
    await test.expect.poll(() => posts.length).toBe(32);         // 30 pings + downvote + reason
    test.expect(posts[posts.length - 1].reason).toContain('Outdated');
    // nothing else was queued: the panel stays closed
    await page.waitForTimeout(600);
    await test.expect(page.locator('#rpwrap')).toHaveCount(0);
    await ctx.close();
  });

  test('answer lock leaves no vote buttons on revisited questions', async () => {
    const { page, ctx } = await newPage(browser);
    await gotoHome(page);
    await page.click('#chapters button[data-chapter="1"]');
    await page.waitForSelector('.run');
    await page.click('.opt[data-i="0"]');
    await page.locator('#nextbtn').click();
    await page.locator('#backbtn').click();
    await test.expect(page.locator('.opt').first()).toBeDisabled();
    await test.expect(page.locator('#fb .votebar')).toHaveCount(0);
    await ctx.close();
  });
});
