// F2: share/SEO tags present on both pages, absolute and consistent URLs, share image exists with the right size.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FR = 'https://futubanane.github.io/opsigne-site/', EN = FR + 'en/';
const pages = { fr: ['index.html', FR, 'fr_FR', 'en_GB'], en: ['en/index.html', EN, 'en_GB', 'fr_FR'] };
const tags = (h, re) => [...h.matchAll(re)].map((m) => m[1]);
const meta = (h, key, val) => { const m = [...h.matchAll(/<meta\s+(property|name)="([^"]+)"\s+content="([^"]*)">/g)].filter((x) => x[1] === key && x[2] === val); return m.map((x) => x[3]); };

for (const [l, [file, url, loc, alt]] of Object.entries(pages)) {
  const h = fs.readFileSync(path.join(ROOT, file), 'utf8');
  test(`${l}: every share tag present once, with the expected value`, () => {
    const one = (k, v) => { const r = meta(h, k, v); assert.strictEqual(r.length, 1, `${v} must appear exactly once`); return r[0]; };
    assert.strictEqual(one('property', 'og:type'), 'website');
    assert.strictEqual(one('property', 'og:site_name'), 'OPSIGNE');
    assert.strictEqual(one('property', 'og:title'), h.match(/<title>(.*?)<\/title>/)[1]);
    assert.strictEqual(one('property', 'og:description'), one('name', 'description'));
    assert.strictEqual(one('property', 'og:url'), url);
    assert.strictEqual(one('property', 'og:image'), FR + 'logo/og-image.png');
    assert.strictEqual(one('property', 'og:image:width'), '1200');
    assert.strictEqual(one('property', 'og:image:height'), '630');
    assert.ok(one('property', 'og:image:alt').length > 20);
    assert.strictEqual(one('property', 'og:locale'), loc);
    assert.strictEqual(one('property', 'og:locale:alternate'), alt);
    assert.strictEqual(one('name', 'twitter:card'), 'summary_large_image');
  });
  test(`${l}: canonical + hreflang fr/en/x-default are absolute, each once, and match`, () => {
    assert.deepStrictEqual(tags(h, /<link rel="canonical" href="([^"]*)">/g), [url]);
    const alts = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]*)">/g)].map((m) => [m[1], m[2]]);
    assert.deepStrictEqual(alts, [['fr', FR], ['en', EN], ['x-default', FR]]);
    for (const u of [...tags(h, /<link rel="canonical" href="([^"]*)">/g), ...alts.map((a) => a[1])]) assert.match(u, /^https:\/\/futubanane\.github\.io\/opsigne-site\//);
  });
  test(`${l}: CSP unchanged (strict, no new origin needed for the crawler-only image)`, () => {
    const csp = h.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
    assert.match(csp, /default-src 'none'/); assert.match(csp, /img-src 'self' data:/); assert.doesNotMatch(csp, /https?:/);
  });
}
test('both pages share the same image URL and the file is a 1200x630 PNG under 100 KB', () => {
  const f = path.join(ROOT, 'logo', 'og-image.png'); const b = fs.readFileSync(f);
  assert.strictEqual(b.subarray(1, 4).toString(), 'PNG');
  assert.strictEqual(b.readUInt32BE(16), 1200); assert.strictEqual(b.readUInt32BE(20), 630);
  assert.ok(b.length < 100 * 1024, `size ${b.length}`);
});
