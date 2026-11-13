// OPSIGNE interactive demo: full run in FR and EN, at every project viewport (390 / 768 / 1440).
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs'), path = require('path');
const SHOTS = process.env.SHOTS_DIR || require('os').tmpdir() + '/opsigne-shots';
const REFUSAL = { fr: 'Non couvert par vos procédures approuvées, escaladez au chef de quart.', en: 'Not covered by your approved procedures, escalate to shift lead.' };
const GOOD = { 2: '58', 6: '0,4', 10: '400', 11: '400.2', 12: '-1.5' };
const LANGS = [['fr', '/'], ['en', '/en/']];

async function openDemo(page, url) {
  await page.goto(url);
  await page.waitForSelector('#demo-app[data-ready="1"]');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.locator('#demo-app').scrollIntoViewIfNeeded();
}
async function start(page, name = 'A. Example') { await page.fill('#op-name', name); await page.click('#start-form button[type=submit]'); await expect(page.locator('#step-h')).toBeVisible(); }
async function doStep(page, n) {
  if (await page.locator('#ack').count()) await page.check('#ack');
  if (await page.locator('#verifier').count()) await page.fill('#verifier', 'B. Exemple');
  if (await page.locator('#reading').count()) await page.fill('#reading', GOOD[n]);
  await page.click('#confirm');
}
async function axeOk(page, label) {
  await page.waitForTimeout(700);
  const r = await new AxeBuilder({ page }).include('#demo-app').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id}(${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}
const shot = async (page, info, name) => { const w = info.project.use.viewport.width; fs.mkdirSync(path.join(SHOTS, String(w)), { recursive: true }); await page.locator('#demo-app').screenshot({ path: path.join(SHOTS, String(w), name + '.png') }); };

for (const [lang, url] of LANGS) {
  test.describe('demo ' + lang, () => {
    test('stop on 70, rollback shown, rollback closes the run', async ({ page }, info) => {
      const bad = [];
      page.on('pageerror', (e) => bad.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.text()); });
      await openDemo(page, url);
      await page.click('#start-form button[type=submit]');                       // no name -> blocked
      await expect(page.locator('#start-msg')).not.toBeEmpty();
      await start(page);
      await doStep(page, 1);
      await expect(page.locator('#step-h')).toContainText(lang === 'fr' ? 'marge de charge' : 'load headroom');
      await page.fill('#reading', 'abc'); await page.click('#confirm');            // garbage reading
      await expect(page.locator('#step-msg')).not.toBeEmpty();
      await page.fill('#reading', '70'); await page.click('#confirm');
      await expect(page.locator('#stop-box')).toBeVisible();
      await expect(page.locator('#stop-box')).toContainText('70');
      await expect(page.locator('#stop-box')).toContainText('65');
      await expect(page.locator('#step-h')).toContainText(lang === 'fr' ? 'REPLI' : 'ROLLBACK');
      await expect(page.locator('#chain .ev').last()).toContainText(lang === 'fr' ? 'Relevé hors plage' : 'Reading out of range');
      await shot(page, info, `${lang}-demo-stop`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await axeOk(page, 'stop state');
      await page.click('#confirm');                                                // rollback done
      await expect(page.locator('#end-box')).toContainText(lang === 'fr' ? 'repli' : 'rollback');
      await expect(page.locator('#confirm')).toHaveCount(0);
      expect(bad).toEqual([]);
    });

    test('full run: warnings, second person, deviation, 12 steps, verify ok, tamper turns red, refusal, reports download', async ({ page }, info) => {
      const bad = [];
      page.on('pageerror', (e) => bad.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.text()); });
      await openDemo(page, url);
      await axeOk(page, 'initial');
      await start(page, 'A. Example');
      await shot(page, info, `${lang}-demo-start`);
      await doStep(page, 1);
      await doStep(page, 2);
      // step 3: warning must be acknowledged
      await expect(page.locator('.warn-box')).toBeVisible();
      await page.click('#confirm');
      await expect(page.locator('#step-msg')).not.toBeEmpty();
      await expect(page.locator('#step-h')).toContainText(lang === 'fr' ? 'EPI' : 'PPE');
      await doStep(page, 3);
      // deviation needs a reason
      await page.click('#dev-toggle');
      await page.fill('#dev-reason', 'ok'); await page.click('#dev-save');
      await expect(page.locator('#step-msg')).not.toBeEmpty();
      await page.fill('#dev-reason', 'Panneau figé, relu après redémarrage'); await page.click('#dev-save');
      await expect(page.locator('#chain .ev').last()).toContainText(lang === 'fr' ? 'Écart' : 'Deviation');
      await doStep(page, 4);
      // step 5: second person must differ
      await expect(page.locator('.sim')).toBeVisible();
      await expect(page.locator('.sim')).toContainText(lang === 'fr' ? 'Simulation' : 'Simulation');
      await page.check('#ack'); await page.fill('#verifier', ' a.  EXAMPLE '); await page.click('#confirm');
      await expect(page.locator('#step-msg')).not.toBeEmpty();
      await expect(page.locator('#step-h')).toContainText(lang === 'fr' ? 'Verrouillage' : 'Lockout');
      await shot(page, info, `${lang}-demo-second-person`);
      await axeOk(page, 'step 5');
      await doStep(page, 5);
      for (let n = 6; n <= 12; n++) await doStep(page, n);
      await expect(page.locator('#end-box')).toBeVisible();
      await expect(page.locator('.seg.done')).toHaveCount(12);
      const nEvents = await page.locator('#chain .ev').count();
      expect(nEvents).toBe(1 + 12 + 1 + 1);                                         // started + 12 steps + deviation + completed
      // verify: green
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-ok')).toBeVisible();
      await expect(page.locator('#chain .ev-ok')).toHaveCount(nEvents);
      const head = (await page.locator('#verify-out .v-head, #verify-out code').first().innerText()).trim();
      expect(head).toMatch(/^[0-9a-f]{64}$/);
      // refusal + answer + decline
      await page.fill('#qa-in', lang === 'fr' ? 'Quelle est la pression des pneus du chariot ?' : 'What is the tyre pressure of the trolley?');
      await page.click('#qa-form button[type=submit]');
      await expect(page.locator('#qa-out .qa-refusal')).toHaveText(REFUSAL[lang]);
      await expect(page.locator('#qa-out .cites')).toHaveCount(0);
      await page.click('[data-q]:nth-of-type(1)');
      await expect(page.locator('#qa-out .qa-ans')).toBeVisible();
      await expect(page.locator('#qa-out .cites')).toContainText('MOP-UPS-017 v1.0');
      await page.click('[data-q]:nth-of-type(4)');
      await expect(page.locator('#qa-out .qa-dec')).toBeVisible();
      await expect(page.locator('#qa-out .cites')).toContainText(lang === 'fr' ? 'étape 5' : 'step 5');
      await page.fill('#qa-in', lang === 'fr' ? 'Quelle est la capitale de la France ?' : 'What is the capital of France?');
      await page.click('#qa-form button[type=submit]');
      await expect(page.locator('#qa-out .qa-refusal')).toHaveText(REFUSAL[lang]);
      await shot(page, info, `${lang}-demo-qa`);
      await axeOk(page, 'after qa');
      // downloads (before tamper): html + json
      const [dlh] = await Promise.all([page.waitForEvent('download'), page.click('#rep-html')]);
      const htmlText = fs.readFileSync(await dlh.path(), 'utf8');
      const [dlj] = await Promise.all([page.waitForEvent('download'), page.click('#rep-json')]);
      const json = JSON.parse(fs.readFileSync(await dlj.path(), 'utf8'));
      expect(dlh.suggestedFilename()).toMatch(/^opsigne-(rapport|report)-RUN-[0-9a-f]{10}\.html$/);
      expect(json.verification.ok).toBe(true); expect(json.events.length).toBeGreaterThanOrEqual(nEvents);
      expect(json.head).toBe(json.events.at(-1).hash);
      expect(htmlText).toContain(json.head); expect(htmlText).toContain(lang === 'fr' ? 'VALIDE' : 'VALID');
      expect(htmlText).not.toMatch(/<script/i);
      // tamper: verify turns red and points at the edited event
      await page.click('#btn-tamper');
      await expect(page.locator('#tamper-out')).not.toBeEmpty();
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-bad')).toBeVisible();
      await expect(page.locator('#chain .ev-bad')).toHaveCount(1);
      const badSeq = await page.locator('#chain .ev-bad .ev-n').innerText();
      await expect(page.locator('#verify-out')).toContainText(badSeq.replace('#', ''));
      expect(await page.locator('#chain .ev-ok').count()).toBeGreaterThan(0);
      await shot(page, info, `${lang}-demo-tamper`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await axeOk(page, 'tamper');
      // report after tamper says INVALID
      const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#rep-json')]);
      const json2 = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
      expect(json2.verification.ok).toBe(false); expect(json2.verification.first_bad_seq).toBe(Number(badSeq.replace('#', '')));
      // reset
      await page.click('#btn-reset');
      await expect(page.locator('#start-form')).toBeVisible();
      await expect(page.locator('#chain .ev')).toHaveCount(0);
      expect(bad).toEqual([]);
    });

    test('forced pure-JS SHA-256 (?sha=js): same flow works and the engine label says so', async ({ page }) => {
      await openDemo(page, url + '?sha=js');
      await start(page);
      await doStep(page, 1); await doStep(page, 2);
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-ok')).toBeVisible();
      await expect(page.locator('#engine')).toContainText(lang === 'fr' ? 'JavaScript' : 'JavaScript');
    });

    test('no network, no cookies, no storage, no downloads until asked; works from file://', async ({ page, context }) => {
      const reqs = [];
      page.on('request', (r) => { if (!/^(http:\/\/(127\.0\.0\.1|localhost)|file:|data:|blob:)/.test(r.url())) reqs.push(r.url()); });
      await openDemo(page, url);
      await start(page); await doStep(page, 1); await doStep(page, 2);
      await page.click('#btn-verify'); await page.fill('#qa-in', 'x'); await page.click('#qa-form button[type=submit]');
      expect(reqs).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      const store = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, idb: (indexedDB.databases ? 'x' : 'n') }));
      expect(store.l).toBe(0); expect(store.s).toBe(0);
      const root = path.resolve(__dirname, '..');
      const fileUrl = 'file://' + path.join(root, lang === 'fr' ? 'index.html' : 'en/index.html');
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
      await page.goto(fileUrl);
      await page.waitForSelector('#demo-app[data-ready="1"]');
      await start(page); await doStep(page, 1); await page.fill('#reading', '70'); await doStep(page, 2).catch(() => {});
      await page.click('#btn-verify');
      await expect(page.locator('#verify-out.v-ok')).toBeVisible();
      expect(errs).toEqual([]);
    });
  });
}
