// Skills trial 2, task B: the "tamper found" motion. Motion when allowed, none under reduced motion, and the failure
// is still announced and still visible without colour or motion.
const { test, expect } = require('@playwright/test');
const GOOD = { 2: '58', 6: '0,4', 10: '400', 11: '400.2', 12: '-1.5' };
const LANGS = [['fr', '/'], ['en', '/en/']];
const BAD_WORD = { fr: /NON valide/i, en: /NOT valid/i };
const MARK = { fr: 'PREMIER ÉVÉNEMENT EN DÉFAUT', en: 'FIRST BAD EVENT' };

async function openDemo(page, url) {
  await page.goto(url);
  await page.waitForSelector('#demo-app[data-ready="1"]');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.locator('#demo-app').scrollIntoViewIfNeeded();
}
async function doStep(page, n) {
  if (await page.locator('#ack').count()) await page.check('#ack');
  if (await page.locator('#verifier').count()) await page.fill('#verifier', 'B. Exemple');
  if (await page.locator('#reading').count()) await page.fill('#reading', GOOD[n]);
  await page.click('#confirm');
}
// run with 3 completed steps (events after the tampered one exist), tamper, but do NOT press Verify yet
async function tamperedRun(page, url) {
  await openDemo(page, url);
  await page.fill('#op-name', 'A. Example'); await page.click('#start-form button[type=submit]');
  await expect(page.locator('#step-h')).toBeVisible();
  for (const n of [1, 2, 3]) await doStep(page, n);
  await page.click('#btn-tamper');
  await expect(page.locator('#tamper-out')).not.toBeEmpty();
}
const flagAnims = (page) => page.evaluate(() => document.getAnimations().filter((a) => a.id === 'verify-flag').length);

for (const [lang, url] of LANGS) {
  test.describe('verify motion ' + lang, () => {
    test('motion allowed: short, choreographed, transform+opacity only, plain end state', async ({ page }) => {
      await tamperedRun(page, url);
      await page.evaluate(() => { window.__seen = []; const t = setInterval(() => { document.getAnimations().filter((a) => a.id === 'verify-flag').forEach((a) => { if (!window.__seen.includes(a)) window.__seen.push(a); }); }, 5); window.__t = t; });
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-bad')).toBeVisible();
      await page.waitForTimeout(700);
      const info = await page.evaluate(() => {
        clearInterval(window.__t);
        const props = new Set(); let end = 0, targets = new Set();
        window.__seen.forEach((a) => {
          end = Math.max(end, a.effect.getComputedTiming().endTime);
          a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((p) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p); }));
          targets.add(a.effect.target.id || a.effect.target.className);
        });
        return { n: window.__seen.length, props: [...props].sort(), end, nTargets: targets.size };
      });
      expect(info.n).toBeGreaterThanOrEqual(4);            // bad event, its mark, >=1 later event, status box
      expect(info.props).toEqual(['opacity', 'transform']);
      expect(info.end).toBeLessThanOrEqual(600);
      expect(info.nTargets).toBeGreaterThanOrEqual(3);
      // sequence is one-shot and leaves a plain end state
      expect(await flagAnims(page)).toBe(0);
      const end = await page.evaluate(() => { const e = document.querySelector('#chain .ev-bad'), v = document.getElementById('verify-out'); return [getComputedStyle(e).transform, getComputedStyle(e).opacity, getComputedStyle(v).transform, getComputedStyle(v).opacity]; });
      expect(end).toEqual(['none', '1', 'none', '1']);
    });

    test('already-shown events are not re-entered when Verify re-renders the log', async ({ page }) => {
      await tamperedRun(page, url);
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-bad')).toBeVisible();
      const entering = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'ev-in' && a.effect.target.closest('#chain')).length);
      expect(entering).toBe(0);
    });

    test('Verify can be pressed again mid-motion: no stacking, no stuck state', async ({ page }) => {
      await tamperedRun(page, url);
      await page.click('#btn-verify'); await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-bad')).toBeVisible();
      await page.waitForTimeout(700);
      expect(await flagAnims(page)).toBe(0);
      await expect(page.locator('#chain .ev-bad')).toHaveCount(1);
    });

    test('reduced motion: no animation is started, plain end state, same content', async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await tamperedRun(page, url);
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-bad')).toBeVisible();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      await expect(page.locator('#chain .ev-bad .mark-bad')).toContainText(MARK[lang]);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#chain .ev-bad')).opacity)).toBe('1');
      await ctx.close();
    });

    test('status is announced (aria-live) and carried by words/symbols, not by colour or motion', async ({ browser }) => {
      for (const reduced of [false, true]) {
        const ctx = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference', viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        await tamperedRun(page, url);
        await page.click('#btn-verify');
        await expect(page.locator('#verify-out.v-bad')).toBeVisible();
        // 1. polite live region: the visible status box is role=status, and the hidden #live region is aria-live=polite
        expect(await page.locator('#verify-out').getAttribute('role')).toBe('status');
        expect(await page.locator('#live').getAttribute('aria-live')).toBe('polite');
        await expect(page.locator('#live')).toHaveText(BAD_WORD[lang]);
        await expect(page.locator('#live')).toContainText('#');
        // 2. words and a symbol, not just red
        await expect(page.locator('#verify-out')).toContainText('\u2716');
        await expect(page.locator('#verify-out')).toHaveText(BAD_WORD[lang]);
        await expect(page.locator('#chain .ev-bad .mark-bad')).toContainText(MARK[lang]);
        await expect(page.locator('#chain .ev-after .mark-after').first()).toBeVisible();
        // 3. the failure must also be visible with colour removed: borders are structural (thicker + different style), checked by computed style
        const st = await page.evaluate(() => { const b = getComputedStyle(document.querySelector('#chain .ev-bad')), a = getComputedStyle(document.querySelector('#chain .ev-after')); return { bw: parseFloat(b.borderLeftWidth), aStyle: a.borderLeftStyle, bStyle: b.borderLeftStyle }; });
        expect(st.bw).toBeGreaterThanOrEqual(8);
        expect(st.aStyle).toBe('dashed'); expect(st.bStyle).toBe('solid');
        await ctx.close();
      }
    });
  });
}
