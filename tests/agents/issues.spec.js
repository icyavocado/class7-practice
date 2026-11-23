// e2e — the site-issue reporter.
// A "Report an issue" button (footer + gear menu) opens an in-page form that
// captures the app state the moment it opens (route, question, breadcrumbs,
// errors, environment) and POSTs it with the report. The state is shown in a
// collapsible preview and can be excluded with one checkbox.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

test.describe('issue reporter', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  async function mockSend(page, posts) {
    await page.route('**/functions/v1/site-report**', route => {
      posts.push(route.request().postDataJSON());
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
  }

  test('footer button: capture on open, kind+message+diag POST, toast', async () => {
    const { page, ctx } = await newPage(browser);
    const posts = [];
    await mockSend(page, posts);

    await gotoHome(page);
    await page.click('#issuebtn');
    await page.waitForSelector('#ipwrap');
    // the capture froze the state at open: home route, version, environment
    const diag = JSON.parse(await page.textContent('#ipdiagpre'));
    test.expect(diag.route).toBe('home');
    test.expect(diag.version).toMatch(/^v\d/);
    test.expect(diag.storage).toBe('indexeddb');
    test.expect(Array.isArray(diag.steps)).toBe(true);
    test.expect(diag.progress).toBeTruthy();
    test.expect(diag.question).toBeNull();

    // default kind is Bug; fill, keep the attach-box checked, send
    await page.fill('#ipnote', 'The tallies froze after question 3');
    await page.click('#ipsend');
    await test.expect(page.locator('#ipwrap')).toHaveCount(0);
    await test.expect(page.locator('#toast')).toContainText('recorded');
    await test.expect.poll(() => posts.length).toBe(1);
    test.expect(posts[0].kind).toBe('bug');
    test.expect(posts[0].message).toContain('froze');
    test.expect(posts[0].diag.route).toBe('home');
    test.expect(posts[0].device_id).toMatch(/^dv-/);

    // a second report with the attach-box excluded sends no diag at all
    await page.click('#issuebtn');
    await page.waitForSelector('#ipwrap');
    await page.click('#ipstateck');                       // uncheck: exclude
    await test.expect(page.locator('#ipdiagpre')).toBeHidden();
    await page.fill('#ipnote', 'Another issue, nothing attached');
    await page.click('.rpchips .chip:has-text("Suggestion")');
    await page.click('#ipsend');
    await test.expect(page.locator('#ipwrap')).toHaveCount(0);
    await test.expect.poll(() => posts.length).toBe(2);
    test.expect(posts[1].kind).toBe('suggestion');
    test.expect(posts[1].diag).toBeUndefined();
    await ctx.close();
  });

  test('gear menu: report mid-practice captures question + breadcrumbs, cancel sends nothing', async () => {
    const { page, ctx } = await newPage(browser);
    const posts = [];
    await mockSend(page, posts);

    await gotoHome(page);
    await page.click('#chapters button[data-chapter="1"]');
    await page.waitForSelector('.run');
    await page.click('.opt[data-i="0"]');                 // answer -> breadcrumb
    await page.click('#gearbtn');
    await page.waitForSelector('#settings:not([hidden])');
    await page.click('#issuereportbtn');
    await page.waitForSelector('#ipwrap');
    await test.expect(page.locator('#settings')).toBeHidden();

    const diag = JSON.parse(await page.textContent('#ipdiagpre'));
    test.expect(diag.route).toMatch(/^chapter\/1/);       // hash routes are 1-based
    test.expect(diag.mode).toBe('chapter');
    test.expect(diag.question).toMatch(/^ch1-/);
    test.expect(diag.steps.join(' ')).toContain('answer ' + diag.question);

    await page.click('#ipcancel');                        // no POST, panel closes
    await test.expect(page.locator('#ipwrap')).toHaveCount(0);
    await test.expect.poll(() => posts.length).toBe(0);

    // validation: too-short a message blocks the send
    await page.click('#issuebtn');
    await page.waitForSelector('#ipwrap');
    await page.fill('#ipnote', 'no');
    await page.click('#ipsend');
    await test.expect(page.locator('#ipwrap')).toBeVisible();
    await test.expect(page.locator('#ipmsg')).toContainText('words');
    await test.expect.poll(() => posts.length).toBe(0);
    await page.click('#ipcancel');
    await ctx.close();
  });
});
