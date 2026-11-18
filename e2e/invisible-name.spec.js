// F6: an operator name made only of invisible characters is refused like an empty name (FR + EN); a real name still starts a run.
const { test, expect } = require('@playwright/test');
const LANGS = [['fr', '/', /nom d.op[ée]rateur/i], ['en', '/en/', /operator name/i]];
const NAMES = ['\u200b\u200b\u200b', '\u200e\u200f\u202e', '\u2060\ufeff \u00a0', '\u2800', '\u3164'];
for (const [lang, url, re] of LANGS) {
  test(`invisible-only operator name is refused like an empty one (${lang})`, async ({ page }) => {
    await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]');
    await page.locator('#demo-app').scrollIntoViewIfNeeded();
    await page.click('#start-form button[type=submit]'); const emptyMsg = await page.locator('#start-msg').innerText();
    expect(emptyMsg).toMatch(re);
    for (const n of NAMES) {
      await page.fill('#op-name', n); await page.click('#start-form button[type=submit]');
      await expect(page.locator('#start-msg')).toHaveText(emptyMsg);
      await expect(page.locator('#start-form')).toBeVisible(); await expect(page.locator('#run-area')).toBeHidden();
      expect(await page.locator('#count').innerText()).toBe('0');
    }
    await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]');
    await expect(page.locator('#step-h')).toBeVisible(); expect(await page.locator('#count').innerText()).toBe('1');
  });
}
