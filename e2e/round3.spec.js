// OPSIGNE round 3: refusal in the page, collapsed log (last 4 + first bad event), visible scope note, phone length.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const REFUSAL = { fr: 'Non couvert par vos procédures approuvées, escaladez au chef de quart.', en: 'Not covered by your approved procedures, escalate to shift lead.' };
const NOTE = { fr: 'Réponses limitées aux étapes approuvées ; en cas de doute, la demande est refusée.', en: 'Answers are limited to the approved steps; when in doubt the question is refused.' };
const GOOD = { 2: '58', 6: '0,4', 10: '400', 11: '400.2', 12: '-1.5' };
const LANGS = [['fr', '/'], ['en', '/en/']];
const Q = {
  en: { refuse: ['What is the firmware version of module 3?', 'How do I replace the fan of module 3?', 'What is the torque for the backplane screws?', 'Where do I order a replacement module?'], ans: ['How do I roll back if something goes wrong?', 13] },
  fr: { refuse: ['Combien coûte le remplacement d’un module ?', 'Comment remplacer le ventilateur du module 3 ?', 'Quel est le couple de serrage des vis du fond de panier ?', 'Où commander un module de remplacement ?'], ans: ['Comment revenir en arrière en cas de problème ?', 13] },
};
async function open(page, url) { await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]'); await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; }); }
async function runAll(page) {
  await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]');
  for (let n = 1; n <= 12; n++) {
    await expect(page.locator('#step-h')).toBeVisible();
    if (await page.locator('#ack').count()) await page.check('#ack');
    if (await page.locator('#verifier').count()) await page.fill('#verifier', 'B. Exemple');
    if (await page.locator('#reading').count()) await page.fill('#reading', GOOD[n]);
    await page.click('#confirm');
  }
  await expect(page.locator('#end-box')).toBeVisible();
}
for (const [lang, url] of LANGS) {
  test.describe('round 3 ' + lang, () => {
    test('scope note under the question box, exact wording, visible', async ({ page }) => {
      await open(page, url);
      await expect(page.locator('#ask-note')).toHaveText(NOTE[lang]);
      await expect(page.locator('#ask-note')).toBeVisible();
      await expect(page.locator('#qa-in')).toHaveAttribute('aria-describedby', 'ask-note');
    });
    test('questions that share object words but ask something the steps never state are refused in the page; covered rollback is answered', async ({ page }) => {
      await open(page, url);
      for (const q of Q[lang].refuse) {
        await page.fill('#qa-in', q); await page.click('#qa-form button[type=submit]');
        await expect(page.locator('#qa-out .qa-refusal')).toHaveText(REFUSAL[lang]); await expect(page.locator('#qa-out .cites')).toHaveCount(0);
      }
      await page.fill('#qa-in', Q[lang].ans[0]); await page.click('#qa-form button[type=submit]');
      await expect(page.locator('#qa-out .qa-ans')).toBeVisible();
      await expect(page.locator('#qa-out .cites')).toContainText(lang === 'fr' ? 'étape 13' : 'step 13');
    });
    test('log collapsed to the last 4 events, Show all toggle, first bad event stays visible after Verify', async ({ page }) => {
      await open(page, url);
      await runAll(page);                                        // 14 events
      const vis = () => page.locator('#chain .ev:visible');
      await expect(page.locator('#chain .ev')).toHaveCount(14);
      await expect(vis()).toHaveCount(4);
      await expect(page.locator('#log-hid')).toBeVisible();
      const tg = page.locator('#log-toggle');
      await expect(tg).toHaveAttribute('aria-expanded', 'false');
      await tg.click(); await expect(vis()).toHaveCount(14); await expect(tg).toHaveAttribute('aria-expanded', 'true');
      await tg.click(); await expect(vis()).toHaveCount(4);
      await page.click('#btn-tamper'); await page.click('#btn-verify');
      await expect(page.locator('#chain .ev-bad')).toBeVisible();   // event #3 is far outside the last 4, still shown
      await expect(vis()).toHaveCount(5);
      await expect(page.locator('#verify-out')).toContainText('#3'.replace('#', lang === 'fr' ? 'n°' : '#'));
      await page.click('#btn-reset'); await expect(page.locator('#log-toggle')).toBeHidden();
    });
    test('keyboard: the toggle is reachable and works with Enter', async ({ page }) => {
      await open(page, url); await runAll(page);
      await page.locator('#log-toggle').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('#chain .ev:visible')).toHaveCount(14);
    });
    test('phone length: demo box stays compact at 390px (initial <= 2000px) and has no sideways scroll', async ({ page }, info) => {
      await open(page, url); await page.waitForTimeout(2500);
      const h = await page.evaluate(() => Math.round(document.getElementById('demo-app').getBoundingClientRect().height));
      const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(sw).toBe(true);
      if (info.project.use.viewport.width <= 390) expect(h, 'demo height ' + h).toBeLessThanOrEqual(2000);
    });
    test('axe on the demo after a full run with the collapsed log and a refusal (2.5 s settle)', async ({ page }) => {
      await open(page, url); await runAll(page);
      await page.fill('#qa-in', Q[lang].refuse[0]); await page.click('#qa-form button[type=submit]');
      await page.click('#btn-tamper'); await page.click('#btn-verify');
      await page.waitForTimeout(2500);
      const r = await new AxeBuilder({ page }).include('#demo-app').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
