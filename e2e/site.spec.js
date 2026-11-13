// OPSIGNE site checks (round 2): load, CSP/console clean, no external requests, no h-scroll, axe (2.5s settle), copy rules, screenshots (outside repo).
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs'), path = require('path');
const SHOTS = process.env.SHOTS_DIR || require('os').tmpdir() + '/opsigne-shots';
const PAGES = [['fr', '/'], ['en', '/en/']];
const BANNED = /certifi|compliant|conforme à|guarantee|garantit la conformité|secnumcloud|iso ?27001|lorem ipsum/i;
const FOOT = { fr: 'Démo à données fictives. Ce n’est pas un système de sécurité.', en: 'Demo with fictional data. Not a safety system.' };

for (const [name, url] of PAGES) {
  test.describe(name, () => {
    test('loads, no console/CSP errors, no external requests, no h-scroll, all assets 200', async ({ page }, info) => {
      const problems = [], external = [], reqs = [];
      page.on('pageerror', (e) => problems.push('pageerror ' + e.message));
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(m.type() + ' ' + m.text()); });
      page.on('response', (r) => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url()); });
      page.on('request', (r) => { reqs.push(r.url()); const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.push(r.url()); });
      const res = await page.goto(url);
      expect(res.status()).toBe(200);
      await page.waitForTimeout(600);
      expect(await page.locator('#demo-app[data-ready="1"]').count()).toBe(1);
      expect(problems).toEqual([]);
      expect(external).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      const w = info.project.use.viewport.width;
      fs.mkdirSync(path.join(SHOTS, String(w)), { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, String(w), `${name}-fold.png`) });
      // reveal everything, then a full-page shot
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')); });
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS, String(w), `${name}-full.png`), fullPage: true });
    });
    test('axe: zero violations (any impact), 2.5s settle', async ({ page }) => {
      await page.goto(url);
      await page.waitForTimeout(2500);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}(${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
    test('copy rules, footer line, demo-box disclaimer, section order, mailto placeholder, icons', async ({ page, request }) => {
      await page.goto(url);
      const text = await page.locator('body').innerText();
      expect(text).toContain(FOOT[name]);
      expect(await page.locator('#demo-app .demo-disc').first().innerText()).toContain(FOOT[name]);
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(/\d+\s?(€|\$|EUR)\b/);
      expect(text).not.toMatch(/PLACEHOLDER|EMPLACEMENT R|WIREFRAME/i);
      await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
      for (const a of await page.locator('a[href^="mailto:"]').all()) expect(await a.getAttribute('href')).toMatch(/@opsigne\.example/);
      const ids = await page.$$eval('main > section', (s) => s.map((x) => x.id));
      expect(ids.length).toBe(7);
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      expect(csp).toContain("default-src 'none'"); expect(csp).toContain("connect-src 'none'"); expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
      for (const f of ['/logo/favicon.svg', '/logo/favicon.ico', '/logo/png/apple-touch-icon-180.png', '/logo/lockup-light.svg']) expect((await request.get(f)).status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(name);
    });
  });
}

// ---- motion, no-JS, keyboard ----
for (const [name, url] of PAGES) {
  test(`${name}: prefers-reduced-motion -> no running animations, everything visible`, async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(); await page.goto(url); await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity !== '1').length);
    expect(hidden).toBe(0);
    await ctx.close();
  });
  test(`${name}: JavaScript disabled -> content visible, demo says it needs JS`, async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false }); const page = await ctx.newPage(); await page.goto(url);
    const hidden = await page.evaluate(() => 0).catch(() => 0);
    expect(await page.locator('.demo-nojs').count()).toBe(1);
    expect(await page.locator('[data-reveal]').first().evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
    await ctx.close();
  });
  test(`${name}: keyboard only: type a name, Enter starts the run, focus lands on the step heading`, async ({ page }) => {
    await page.goto(url); await page.waitForSelector('#demo-app[data-ready="1"]');
    await page.focus('#op-name'); await page.keyboard.type('K. Board'); await page.keyboard.press('Enter');
    await expect(page.locator('#step-h')).toBeFocused();
    await page.keyboard.press('Tab');                       // heading -> first control (step 1 has: confirm)
    await expect(page.locator('#confirm')).toBeFocused();
    const ring = await page.locator('#confirm').evaluate((e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth);
    expect(ring).toBe('solid 3px');
    await page.keyboard.press('Enter');
    await expect(page.locator('#step-h')).toBeFocused();
  });
}
