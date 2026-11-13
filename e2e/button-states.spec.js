// Skills trial 2, task C: demo button states (hover gated, pressed, disabled, loading).
const { test, expect } = require('@playwright/test');
const LANGS = [['fr', '/'], ['en', '/en/']];
for (const [lang, url] of LANGS) {
  test.describe('button states ' + lang, () => {
    test('disabled never reacts to hover; hover colour only where hover exists; press scales to .97; touch-action set', async ({ page }) => {
      await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]');
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      const bg = (sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
      const canHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
      await page.locator('#btn-tamper').scrollIntoViewIfNeeded();
      const rest = await bg('#btn-tamper'); await page.hover('#btn-tamper', { force: true }); await page.waitForTimeout(350);
      expect(await bg('#btn-tamper')).toBe(rest);                        // disabled: no hover reaction
      await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]');
      await page.locator('#btn-verify').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
      const r0 = await bg('#btn-verify'); await page.hover('#btn-verify'); await page.waitForTimeout(350);
      const r1 = await bg('#btn-verify');
      if (canHover) expect(r1).not.toBe(r0); else expect(r1).toBe(r0);   // phones: no sticky hover after a tap
      await page.mouse.down(); await page.waitForTimeout(250);
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('btn-verify')).transform)).toBe('matrix(0.97, 0, 0, 0.97, 0, 0)');
      await page.mouse.up();
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('btn-verify')).touchAction)).toBe('manipulation');
    });
    test('loading state: never stuck, never shown for fast work', async ({ page }) => {
      await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]');
      await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]');
      await page.click('#btn-verify'); await expect(page.locator('#verify-out.v-ok')).toBeVisible();
      await expect(page.locator('#btn-verify')).not.toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('#btn-verify')).not.toHaveAttribute('data-pending', '1');
      // slow hashing (simulate): the busy state appears after >120 ms and is removed when done
      await page.evaluate(() => { const orig = crypto.subtle.digest.bind(crypto.subtle); crypto.subtle.digest = (...a) => new Promise((r) => setTimeout(() => r(orig(...a)), 300)); });
      await page.click('#btn-verify');
      await expect(page.locator('#btn-verify')).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('#verify-out.v-ok')).toBeVisible();
      await expect(page.locator('#btn-verify')).not.toHaveAttribute('aria-busy', 'true');
    });
  });
}
