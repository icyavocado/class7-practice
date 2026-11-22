// e2e — the community report flow on answered questions (Supabase-backed).
// The edge function is mocked via page.route; the POST payloads and the
// resulting chip are asserted, plus the spacing bar introduced for the
// feedback box.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

test.describe('community reports', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  test('vote buttons post to the report endpoint and update the chip', async () => {
    const { page, ctx } = await newPage(browser);
    const expect = test.expect;
    const posts = [];
    await page.route('**/functions/v1/report-vote**', route => {
      posts.push(route.request().postDataJSON());
      const up = posts.length === 1 ? 3 : 2;
      const down = posts.length === 1 ? 1 : 2;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, up: up, down: down, recorded: posts[posts.length - 1].vote }),
      });
    });
    await page.route('**/rest/v1/question_signal**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ up: 3, down: 1 }]),
    }));

    await gotoHome(page);
    await page.click('#chapters button[data-chapter="1"]');
    await page.waitForSelector('.run');
    await page.click('.opt[data-i="0"]');                       // answer first
    await expect(page.locator('#fb .votebar')).toBeVisible();
    await expect(page.locator('#fb .votebar')).toContainText('Good');
    await expect(page.locator('#fb .votebar')).toContainText('Report');

    await page.click('#votegood');
    await expect(page.locator('#fb .cvsig')).toContainText('3 endorse', { timeout: 5000 });
    await expect(page.locator('#fb .cvsig')).toContainText('1 report');
    expect(posts).toHaveLength(1);
    expect(posts[0].qid).toMatch(/^ch1-/);
    expect(posts[0].vote).toBe('up');
    expect(posts[0].bank_id).toBe('default');
    expect(posts[0].device_id).toMatch(/^dv-/);

    await page.click('#votereport');                            // change the vote
    await expect(page.locator('#fb .cvsig')).toContainText('2 endorse', { timeout: 5000 });
    await expect(page.locator('#fb .cvsig')).toContainText('2 reports');
    expect(posts).toHaveLength(2);
    expect(posts[1].vote).toBe('down');

    // spacing: the bar keeps distance under the feedback box
    const margin = await page.$eval('#fb .votebar', e => getComputedStyle(e).marginTop);
    test.expect(margin).toBe('12px');

    // the details link carries the question id into the GitHub issue form
    const href = await page.getAttribute('#flagq', 'href');
    test.expect(href).toContain('github.com');
    test.expect(href).toContain('template=question-report.yml');
    test.expect(href).toContain('question-id=');
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
