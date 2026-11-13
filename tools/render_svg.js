// usage: node tools/render_svg.js <svg> <out.png> <width> [height] [bg]   (transparent unless bg given). Uses the server's Chrome via playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
(async () => {
  const [svg, out, w, h, bg] = process.argv.slice(2);
  const W = +w, markup = fs.readFileSync(svg, 'utf8');
  const vb = markup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const H = h && h !== '-' ? +h : Math.round(W * (+vb[2]) / (+vb[1]));
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><body style="margin:0;background:${bg || 'transparent'}">${markup.replace('<svg ', `<svg width="${W}" height="${H}" `)}</body>`);
  await p.screenshot({ path: out, omitBackground: !bg, clip: { x: 0, y: 0, width: W, height: H } });
  await b.close();
})();
