// e2e — cloud share codes. Sharing uploads the progress payload to the
// share-progress edge function and hands out a short three-word code link
// (#apple-orange-grape); opening or pasting the code restores via a GET. Offline (or not-yet-deployed)
// sharing falls back to the self-contained #p2 link, which stay decodable.
const test = require('playwright/test');
const { launch, newPage, gotoHome } = require('../helpers');

test.describe('cloud share codes', () => {
  let browser;
  test.beforeAll(async () => { browser = await launch(); });
  test.afterAll(async () => { await browser.close(); });

  async function mockEndpoints(page, opts) {
    const state = { code: 'apple-orange-grape', uploaded: null, fetchedCode: null };
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type' };
    await page.route('**/functions/v1/share-progress**', route => {
      const req = route.request();
      const fulfill = (status, obj) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(obj) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
      if (req.method() === 'POST') {
        if (opts.cloudDown) return route.abort();
        state.uploaded = req.postDataJSON();
        return fulfill(200, { ok: true, code: state.code });
      }
      const code = (new URL(req.url()).searchParams.get('code') || '').toUpperCase();
      state.fetchedCode = code;
      if (opts.cloudDown || code !== state.code.toUpperCase()) return fulfill(404, { error: 'unknown code' });
      return fulfill(200, { ok: true, payload: state.uploaded ? state.uploaded.payload : '' });
    });
    return state;
  }

  async function progressN(page, n) {
    await page.click('#chapters button[data-chapter="1"]');
    await page.waitForSelector('.run');
    for (let i = 0; i < n; i++) {
      await page.click('.opt[data-i="0"]');
      if (i < n - 1) await page.click('#nextbtn');
    }
  }

  async function openShare(page) {
    await page.click('#gearbtn');
    await page.waitForSelector('#settings:not([hidden])');
    await page.click('#sharebtn');
    await page.waitForFunction(() => !document.getElementById('shareout').hidden);
    return page.inputValue('#sharelink');
  }

  test('share uploads and hands out a bare word-code link; opening it restores', async () => {
    const { page, ctx } = await newPage(browser);
    const state = await mockEndpoints(page, {});
    await gotoHome(page);
    await progressN(page, 2);

    const link = await openShare(page);
    test.expect(link).toMatch(/#apple-orange-grape$/);     // a bare word-code link, not a blob
    test.expect(state.uploaded.payload).toMatch(/^[A-Za-z0-9_-]+$/);
    test.expect(state.uploaded.device_id).toMatch(/^dv-/);

    // opening the shared link (simulates the receiver): full load, banner shows
    await page.goto('/#' + state.code);
    await page.reload();
    await page.waitForTimeout(1500);
    console.log('DBG', JSON.stringify(await page.evaluate(async () => {
      const dec = await window.__share.decodeShareLink('p3apple-orange-grape').then(d => 'OK seen=' + d.seen).catch(e => 'ERR ' + (e && e.message));
      return { hash2: location.hash.slice(1), banner: !!document.querySelector('.sharebanner'), dec };
    })));
    await page.waitForSelector('.sharebanner', { timeout: 10000 });
    test.expect(await page.textContent('.sharebanner')).toContain('2 seen');
    test.expect((state.fetchedCode || '').toLowerCase()).toBe('apple-orange-grape');   // codes are case-insensitive
    await page.click('#impshare');
    await page.waitForSelector('.idle');
    await ctx.close();
  });

  test('pasting just the code restores through the same GET', async () => {
    const { page, ctx } = await newPage(browser);
    const state = await mockEndpoints(page, {});
    await gotoHome(page);
    await progressN(page, 3);
    await openShare(page);

    await page.click('#restorebtn');
    await page.waitForSelector('#restorebox:not([hidden])');
    await page.fill('#restorelink', 'apple-orange-grape');    // bare code, no URL
    await test.expect.poll(() => page.textContent('#restorepreview'), { timeout: 10000 }).toContain('3 seen');
    test.expect((state.fetchedCode || '').toLowerCase()).toBe('apple-orange-grape');
    await test.expect(page.locator('#doimport')).toBeVisible();
    await page.click('#ignoreimport');
    await ctx.close();
  });

  test('the pretty /s/<code> path restores; the ?s= fallback normalizes to it', async () => {
    const { page, ctx } = await newPage(browser);
    const state = await mockEndpoints(page, {});
    await gotoHome(page);
    await progressN(page, 2);
    await openShare(page);
    // pretty path: restore directly from /s/apple-orange-grape
    await page.goto('/s/apple-orange-grape');
    await page.waitForSelector('.sharebanner', { timeout: 10000 });
    test.expect(await page.textContent('.sharebanner')).toContain('2 seen');
    await page.click('#impshare');
    await page.waitForSelector('.idle');
    // the ?s= query (Pages 404 fallback) normalizes to the pretty path
    await page.goto('/?s=apple-orange-grape');
    await page.waitForFunction(() => document.querySelector('.sharebanner'), undefined, { timeout: 10000 });
    test.expect(new URL(page.url()).pathname).toBe('/s/apple-orange-grape');
    await page.click('#ignshare');
    await ctx.close();
  });

  test('offline sharing falls back to the self-contained #p2 link', async () => {
    const { page, ctx } = await newPage(browser);
    await mockEndpoints(page, { cloudDown: true });
    await gotoHome(page);
    await progressN(page, 1);
    const link = await openShare(page);
    test.expect(link).toMatch(/#p2[A-Za-z0-9_-]+$/);
    await ctx.close();
  });
});
