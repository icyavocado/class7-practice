// Shared e2e helpers.
const { chromium } = require('playwright');

// Launch a fresh browser context with a WIPED IndexedDB so every test
// starts with clean progress.
async function newPage(browser) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    // wipe once per context: repeated runs (e.g. page.reload()) must keep the
    // database so parked-run restore after refresh is observable
    try {
      if (sessionStorage.getItem('__idbWiped')) return;
      sessionStorage.setItem('__idbWiped', '1');
      indexedDB.deleteDatabase('class7-practice');
    } catch (e) {}
  });
  // community-report endpoints answered locally by default (no network):
  // reports.spec registers its own page-level routes, which take precedence
  // over these context-level ones. The 204 keeps answered-pings silent.
  await ctx.route('**/functions/v1/report-vote**', route => route.fulfill({ status: 204, body: '' }));
  await ctx.route('**/functions/v1/site-report**', route => route.fulfill({ status: 204, body: '' }));
  await ctx.route('**/rest/v1/question_signal**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  return { page, ctx };
}

// Launch the shared browser once per worker.
async function launch() {
  return chromium.launch({ channel: 'chrome', headless: true });
}

// Load the app and wait for the idle (overview) view.
async function gotoHome(page) {
  await page.goto('/');
  await page.waitForSelector('.idle', { timeout: 10000 });
  return page;
}

module.exports = { newPage, gotoHome, launch };
