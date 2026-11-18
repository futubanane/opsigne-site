// F7: a verify (or start, or report) result that arrives after a Reset must be ignored: no stale red/green message, no ghost run.
const { test, expect } = require('@playwright/test');
const LANGS = [['fr', '/'], ['en', '/en/']];
async function open(page, url) { await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]'); await page.locator('#demo-app').scrollIntoViewIfNeeded(); }
async function start(page) { await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]'); await expect(page.locator('#step-h')).toBeVisible(); }
const slowHash = (page, ms) => page.evaluate((d) => { const o = crypto.subtle.digest.bind(crypto.subtle); crypto.subtle.digest = (...a) => new Promise((r) => setTimeout(() => r(o(...a)), d)); }, ms);
for (const [lang, url] of LANGS) {
  test.describe('verify/reset race ' + lang, () => {
    test('verify then reset in the same tick (slow hashing): no stale verify message, empty log', async ({ page }) => {
      await open(page, url); await start(page);
      await page.click('#confirm'); await expect(page.locator('#count')).toHaveText('2');
      await slowHash(page, 250);
      await page.evaluate(() => { document.getElementById('btn-verify').click(); document.getElementById('btn-reset').click(); });
      await page.waitForTimeout(1500);                                  // longer than the slow verify
      await expect(page.locator('#verify-out.v-bad')).toHaveCount(0);
      await expect(page.locator('#verify-out.v-ok')).toHaveCount(0);
      await expect(page.locator('#verify-out')).toHaveClass(/v-none/);
      await expect(page.locator('#chain li')).toHaveCount(0); await expect(page.locator('#count')).toHaveText('0');
      await expect(page.locator('#start-form')).toBeVisible();
    });
    test('tampered run: verify then reset immediately never leaves the red "chain not valid" text', async ({ page }) => {
      await open(page, url); await start(page);
      await page.click('#confirm'); await page.click('#btn-tamper');
      await slowHash(page, 200);
      await page.evaluate(() => { document.getElementById('btn-verify').click(); document.getElementById('btn-reset').click(); });
      await page.waitForTimeout(1800);
      await expect(page.locator('#verify-out.v-bad')).toHaveCount(0);
      await expect(page.locator('#chain li')).toHaveCount(0);
    });
    test('real (non-simulated) timing: verify click then reset click 0 ms apart, repeated 5 times', async ({ page }) => {
      await open(page, url);
      for (let i = 0; i < 5; i++) {
        await start(page); await page.click('#confirm'); await page.click('#btn-tamper');
        await page.evaluate(() => { document.getElementById('btn-verify').click(); document.getElementById('btn-reset').click(); });
        await page.waitForTimeout(400);
        await expect(page.locator('#verify-out.v-bad')).toHaveCount(0); await expect(page.locator('#count')).toHaveText('0');
      }
    });
    test('start then reset in the same tick: no ghost run appears afterwards', async ({ page }) => {
      await open(page, url); await slowHash(page, 250);
      await page.fill('#op-name', 'A. Example');
      await page.evaluate(() => { document.querySelector('#start-form button[type=submit]').click(); document.getElementById('btn-reset').click(); });
      await page.waitForTimeout(1500);
      await expect(page.locator('#start-form')).toBeVisible(); await expect(page.locator('#run-area')).toBeHidden(); await expect(page.locator('#count')).toHaveText('0');
    });
    test('after the race the demo still works: new run, verify ok', async ({ page }) => {
      await open(page, url); await start(page); await slowHash(page, 200);
      await page.evaluate(() => { document.getElementById('btn-verify').click(); document.getElementById('btn-reset').click(); });
      await page.waitForTimeout(1000);
      await start(page); await page.click('#btn-verify'); await expect(page.locator('#verify-out.v-ok')).toBeVisible();
    });
  });
}
