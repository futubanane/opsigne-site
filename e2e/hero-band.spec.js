// Hero 1 "Chain band" (live page): band order, first screen at four sizes, phone layout, reduced motion, screen-reader reading order.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const PAGES = [['fr', '/'], ['en', '/en/']];
const SIZES = [[1440, 900], [768, 1024], [390, 844], [360, 780]];
const WORDS = { fr: { ok: 'lié', bad: 'rompu', stop: /ARRÊT/, fict: 'Données fictives', label: /^Illustration fictive/ }, en: { ok: 'linked', bad: 'broken', stop: /STOP/, fict: 'Fictional data', label: /^Fictional illustration/ } };
const box = async (loc) => (await loc.boundingBox());

for (const [name, url] of PAGES) {
  const W = WORDS[name];
  test.describe(`hero band ${name}`, () => {
    test('band is visible and ordered: #1 -> link ok -> #2 -> link broken -> #3, then the STOP line; Fictional data label shown', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(url); await page.waitForTimeout(1500);
      const blk = page.locator('.hero .band-chain .blk'), lnk = page.locator('.hero .band-chain .lnk');
      await expect(blk).toHaveCount(3); await expect(lnk).toHaveCount(2);
      await expect(page.locator('.hero .band')).toBeVisible();
      expect(await blk.allInnerTexts()).toEqual([expect.stringContaining('#1'), expect.stringContaining('#2'), expect.stringContaining('#3')]);
      expect((await lnk.first().innerText()).toLowerCase()).toBe(W.ok);
      expect((await lnk.last().innerText()).toLowerCase()).toBe(W.bad);
      await expect(lnk.first()).toHaveClass(/ok/); await expect(lnk.last()).toHaveClass(/bad/); await expect(blk.last()).toHaveClass(/bad/);
      const [b1, l1, b2, l2, b3, stop] = await Promise.all([box(blk.nth(0)), box(lnk.first()), box(blk.nth(1)), box(lnk.last()), box(blk.nth(2)), box(page.locator('.hero .band-stop'))]);
      // wide band: same row, strictly left to right, links sit between the blocks
      expect(Math.abs(b1.y - b3.y)).toBeLessThan(4);
      expect(b1.x + b1.width).toBeLessThanOrEqual(l1.x); expect(l1.x + l1.width).toBeLessThanOrEqual(b2.x);
      expect(b2.x + b2.width).toBeLessThanOrEqual(l2.x); expect(l2.x + l2.width).toBeLessThanOrEqual(b3.x);
      expect(stop.y).toBeGreaterThan(b3.y + b3.height - 1);
      expect(await page.locator('.hero .band-stop').innerText()).toMatch(W.stop);
      expect(await page.locator('.hero .band-stop').innerText()).toMatch(/70\s?%/);
      expect(await page.locator('.hero .band').innerText()).toContain(W.fict);
      // the headline is the owner's text, unchanged
      expect((await page.locator('h1').innerText()).length).toBeGreaterThan(60);
    });

    for (const [w, h] of SIZES) {
      test(`first screen ${w}x${h}: headline, main call to action and demo link inside the viewport, nothing clipped`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(url); await page.waitForTimeout(1200);
        const vh = h;
        const h1 = await box(page.locator('h1')), cta = await box(page.locator('.hero .row .btn').first()), sec = await box(page.locator('.hero .row .btn.ghost'));
        expect(h1.y).toBeGreaterThanOrEqual(0); expect(h1.y + h1.height).toBeLessThanOrEqual(vh);
        expect(cta.y + cta.height).toBeLessThanOrEqual(vh); expect(sec.y + sec.height).toBeLessThanOrEqual(vh);
        // the first block of the band peeks into the first screen at desktop/tablet sizes (a cue that the picture is the log); not required on a phone
        // nothing wider than the viewport, nothing cut at the sides
        const out = await page.evaluate(() => { const W = document.documentElement.clientWidth, bad = []; document.querySelectorAll('.hero *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.left < -0.5 || r.right > W + 0.5)) bad.push(e.className || e.tagName); }); return { bad, h: document.documentElement.scrollWidth > W }; });
        expect(out.bad).toEqual([]); expect(out.h).toBe(false);
        const clipped = await page.evaluate(() => [...document.querySelectorAll('.hero *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => e.className));
        expect(clipped).toEqual([]);
      });
    }

    test('no horizontal scroll at 320 px, band fully inside the screen', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(url); await page.waitForTimeout(1200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      const b = await box(page.locator('.hero .band')); expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(320);
    });

    test('phone: the chain is vertical (#1 above #2 above #3, links between); desktop and tablet: horizontal', async ({ page }) => {
      for (const [w, vertical] of [[360, true], [390, true], [640, true], [768, false], [1440, false]]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.goto(url); await page.waitForTimeout(1500);   // let the entrance and the nudge finish so positions are final
        const blk = page.locator('.hero .band-chain .blk'), lnk = page.locator('.hero .band-chain .lnk');
        const [b1, b2, b3, l1, l2] = await Promise.all([box(blk.nth(0)), box(blk.nth(1)), box(blk.nth(2)), box(lnk.first()), box(lnk.last())]);
        if (vertical) {
          expect(b1.y + b1.height, `w${w}`).toBeLessThanOrEqual(l1.y); expect(l1.y + l1.height, `w${w}`).toBeLessThanOrEqual(b2.y);
          expect(b2.y + b2.height, `w${w}`).toBeLessThanOrEqual(l2.y); expect(l2.y + l2.height, `w${w}`).toBeLessThanOrEqual(b3.y);
          expect(Math.abs(b1.x - b3.x), `w${w}`).toBeLessThan(2);
        } else {
          expect(Math.abs(b1.y - b3.y), `w${w}`).toBeLessThan(4); expect(b1.x, `w${w}`).toBeLessThan(b2.x); expect(b2.x, `w${w}`).toBeLessThan(b3.x);
        }
      }
    });

    test('motion: the broken-link nudge uses the --ease token, only transform + opacity, stays short; reduced motion: nothing animates, everything visible', async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
      const page = await ctx.newPage(); await page.goto(url);
      const info = await page.evaluate(() => {
        const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease').trim();
        const bad = document.querySelector('.hero .band-chain .blk.bad'), cs = getComputedStyle(bad);
        const rules = {}; for (const s of document.styleSheets) for (const r of s.cssRules) if (r.type === CSSRule.KEYFRAMES_RULE && /^hero-/.test(r.name)) rules[r.name] = [...new Set([...r.cssRules].flatMap((k) => [...k.style]))];
        return { ease, names: cs.animationName, timing: cs.animationTimingFunction, dur: cs.animationDuration, rules };
      });
      expect(info.ease).toBe('cubic-bezier(.16,1,.3,1)');
      expect(info.names).toContain('hero-nudge');
      const norm = (s) => s.replace(/\s/g, '').replace(/0\./g, '.');
      for (const t of info.timing.split(/,(?![^(]*\))/)) expect(norm(t)).toBe(norm(info.ease));
      expect(Object.keys(info.rules).sort()).toEqual(['hero-nudge', 'hero-rise']);
      for (const props of Object.values(info.rules)) for (const p of props) expect(['transform', 'opacity']).toContain(p);
      for (const d of info.dur.split(',')) expect(parseFloat(d)).toBeLessThanOrEqual(0.5);
      await ctx.close();
      const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const rp = await rctx.newPage(); await rp.goto(url); await rp.waitForTimeout(300);
      const r = await rp.evaluate(() => ({ running: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.hero')).length, blocks: [...document.querySelectorAll('.hero .band-chain .blk')].map((b) => { const c = getComputedStyle(b); return [c.opacity, c.transform, c.animationName]; }) }));
      expect(r.running).toBe(0);
      for (const [o, t, a] of r.blocks) { expect(o).toBe('1'); expect(t).toBe('none'); expect(a).toBe('none'); }
      await rctx.close();
    });

    test('screen readers: headline, lead, buttons, then ONE picture with a text equivalent; the drawing inside is hidden (not announced twice)', async ({ page }) => {
      await page.goto(url);
      const fig = page.locator('.hero figure.band');
      await expect(fig).toHaveAttribute('role', 'img');
      const label = await fig.getAttribute('aria-label'); expect(label).toMatch(W.label); expect(label).toMatch(/70\s?%/); expect(label).toMatch(/65\s?%/);
      await expect(fig.locator('> div')).toHaveAttribute('aria-hidden', 'true');
      const snap = await page.locator('.hero').ariaSnapshot();
      const lines = snap.split('\n').map((l) => l.trim());
      const idx = (re, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));
      const iH = idx(/heading .*level=1/), iP = idx(/paragraph/, idx(/heading .*level=1/)), iL = idx(/link/), iImg = idx(/img /);
      expect(iH).toBeGreaterThanOrEqual(0); expect(iH).toBeLessThan(iP); expect(iP).toBeLessThan(iL); expect(iL).toBeLessThan(iImg);
      expect(lines.filter((l) => /img /.test(l)).length).toBe(1);
      expect(snap).not.toMatch(/a3f9|51d0|7c1e/);                     // the hash fragments are not read out
      expect(lines.filter(Boolean).pop()).toMatch(/^- 'img |^- img /);   // the picture is a leaf: no text nodes under it, so the labels inside the drawing are not read a second time
      expect(snap).not.toMatch(/#1|#2|#3|Hold point|Point d’arrêt/);
      expect(await page.locator('.hero [aria-hidden="true"] a, .hero [aria-hidden="true"] button, .hero [aria-hidden="true"] [tabindex]').count()).toBe(0); // nothing focusable is hidden
      // DOM order = reading order = visual order
      const order = await page.evaluate(() => { const q = (s) => document.querySelector(s); const pos = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); return [pos(q('.hero .eyebrow'), q('.hero h1')), pos(q('.hero h1'), q('.hero .lead')), pos(q('.hero .lead'), q('.hero .row')), pos(q('.hero .row'), q('.hero figure'))]; });
      expect(order).toEqual([true, true, true, true]);
    });

    test('axe on the hero straight after load (no settle time, entrance animation running): zero violations, so no frame of the motion drops below contrast', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      const r = await new AxeBuilder({ page }).include('.hero').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
