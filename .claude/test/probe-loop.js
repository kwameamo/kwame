/* Counts sampler runs while the page is idle: should settle, not loop. */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:8731/roll.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.br-all .br-tile');
  await page.waitForTimeout(2500);
  // Instrument: count elementsFromPoint calls over 2 idle seconds
  const calls = await page.evaluate(() => new Promise(res => {
    let n = 0; const orig = document.elementsFromPoint.bind(document);
    document.elementsFromPoint = function () { n++; return orig.apply(document, arguments); };
    setTimeout(() => res(n), 2000);
  }));
  console.log('idle elementsFromPoint calls in 2s:', calls);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
