// usage: node tools/make_og.js   -> writes logo/og-image.png (1200x630). Local render with the server's Chrome; no network.
// Content: the existing light lockup + the broken-chain motif of the hero band + fictional-data caption. No claims, no figures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const lockup = fs.readFileSync(path.join(ROOT, 'logo', 'lockup-light.svg'), 'utf8').replace('<svg ', '<svg width="720" height="160" ');
  const html = `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#F7F2E9;color:#2B2118;font:600 26px/1.3 system-ui,"Segoe UI",Roboto,Arial,sans-serif;position:relative;overflow:hidden}
  .bar{position:absolute;left:0;top:0;width:1200px;height:18px;background:#8F4524}
  .logo{position:absolute;left:90px;top:110px}
  .chain{position:absolute;left:90px;top:360px;display:flex;align-items:center;gap:0}
  .blk{border:2px solid #85745F;border-radius:12px;background:#FFFCF6;padding:16px 24px;font:600 30px/1.3 ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;width:200px}
  .blk small{display:block;font-size:24px;color:#5B4F43}
  .blk.bad{border:4px solid #A0261C;background:#F8E1DB}.blk.bad small{color:#A0261C}
  .w{width:70px;height:4px;background:#2A6340}.w.bad{background:#A0261C}
  .cap{position:absolute;left:90px;top:520px;font:600 26px/1.4 ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;color:#5B4F43;letter-spacing:.06em;text-transform:uppercase}
  </style><div class="bar"></div><div class="logo">${lockup}</div>
  <div class="chain"><div class="blk">#1<small>a3f9&hellip;</small></div><div class="w"></div><div class="blk">#2<small>7c1e&hellip;</small></div><div class="w bad"></div><div class="blk bad">#3<small>51d0&hellip;</small></div></div>
  <div class="cap">Demo &middot; fictional data &middot; donn&eacute;es fictives</div>`;
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(html);
  await p.screenshot({ path: path.join(ROOT, 'logo', 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await b.close();
})();
