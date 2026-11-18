// F4: rapid double / triple activation (programmatic, same tick) of Confirm step, Verify, Reset and Start.
// The log stays valid, no sequence gap, one event per step, no error message.
const { test, expect } = require('@playwright/test');
const LANGS = [['fr', '/'], ['en', '/en/']];
async function openDemo(page, url) {
  await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.locator('#demo-app').scrollIntoViewIfNeeded();
}
const burst = (page, sel, n) => page.evaluate(([s, k]) => { const b = document.querySelector(s); for (let i = 0; i < k; i++) b.click(); }, [sel, n]);
const count = async (page) => Number(await page.locator('#count').innerText());
async function verifyOk(page, expected) {
  await page.click('#btn-verify'); await expect(page.locator('#verify-out.v-ok')).toBeVisible();
  await expect(page.locator('#verify-out')).toContainText(String(expected));
  await expect(page.locator('#verify-out.v-bad')).toHaveCount(0);
}
async function startRun(page) { await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]'); await expect(page.locator('#step-h')).toBeVisible(); }

for (const [lang, url] of LANGS) {
  test.describe('double activation ' + lang, () => {
    for (const n of [2, 3]) {
      test(`Confirm step x${n} in one tick: one event per step, log valid, no gap`, async ({ page }) => {
        await openDemo(page, url); await startRun(page);
        expect(await count(page)).toBe(1);
        await burst(page, '#confirm', n);                                  // step 1 (plain)
        await expect(page.locator('#step-h')).toBeVisible(); await page.waitForTimeout(250);
        expect(await count(page)).toBe(2);                                 // run_started + exactly one step_completed
        await expect(page.locator('#step-msg')).toHaveText('');
        await page.fill('#reading', '58'); await burst(page, '#confirm', n);   // step 2 (hold point, in range)
        await page.waitForTimeout(250);
        expect(await count(page)).toBe(3);
        await expect(page.locator('#step-msg')).toHaveText('');
        await verifyOk(page, 3);
      });
    }
    test('Confirm step burst on a hold point with an out-of-range reading records ONE stop event', async ({ page }) => {
      await openDemo(page, url); await startRun(page);
      await burst(page, '#confirm', 1); await page.waitForTimeout(250);
      await page.fill('#reading', '70'); await burst(page, '#confirm', 3); await page.waitForTimeout(300);
      expect(await count(page)).toBe(3);                                   // started, step 1, reading_out_of_range
      await verifyOk(page, 3);
    });
    test('Verify x3 in one tick: one valid result, nothing recorded', async ({ page }) => {
      await openDemo(page, url); await startRun(page);
      await burst(page, '#confirm', 1); await page.waitForTimeout(250);
      await burst(page, '#btn-verify', 3);
      await expect(page.locator('#verify-out.v-ok')).toBeVisible(); await page.waitForTimeout(250);
      expect(await count(page)).toBe(2);
      await expect(page.locator('#verify-out.v-bad')).toHaveCount(0);
      await expect(page.locator('#btn-verify')).not.toHaveAttribute('data-pending', '1');
    });
    for (const n of [2, 3]) {
      test(`Reset x${n} in one tick: clean empty state, no error`, async ({ page }) => {
        await openDemo(page, url); await startRun(page);
        await burst(page, '#confirm', 1); await page.waitForTimeout(250);
        await burst(page, '#btn-reset', n); await page.waitForTimeout(250);
        await expect(page.locator('#start-form')).toBeVisible(); await expect(page.locator('#run-area')).toBeHidden();
        expect(await count(page)).toBe(0);
        await expect(page.locator('#verify-out.v-bad')).toHaveCount(0);
        await startRun(page); expect(await count(page)).toBe(1); await verifyOk(page, 1);   // a fresh run still works
      });
    }
    for (const n of [2, 3]) {
      test(`Start x${n} in one tick: one run, one run_started event`, async ({ page }) => {
        await openDemo(page, url);
        await page.fill('#op-name', 'A. Example');
        await page.evaluate((k) => { const f = document.getElementById('start-form'); for (let i = 0; i < k; i++) f.querySelector('button[type=submit]').click(); }, n);
        await expect(page.locator('#step-h')).toBeVisible(); await page.waitForTimeout(250);
        expect(await count(page)).toBe(1);
        await verifyOk(page, 1);
      });
    }
  });
}
