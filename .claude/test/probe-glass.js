/* Puts glass panes over photos and reports what the sampler decided. */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const out = {};
  await page.goto('http://localhost:8731/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#br-preview a.br-pv img');
  await page.waitForTimeout(800);
  // Park the sticky nav over the first row of preview tiles
  await page.evaluate(() => { const r = document.querySelector('#br-preview').getBoundingClientRect(); window.scrollBy(0, r.top - 12 + 40); });
  await page.waitForTimeout(900);
  out.homeNav = await page.evaluate(() => ({ mode: document.getElementById('site-nav').getAttribute('data-lg'), alpha: document.getElementById('site-nav').style.getPropertyValue('--lg-alpha') }));
  await page.screenshot({ path: '.claude/test/glass-nav-photos.png', clip: { x: 280, y: 0, width: 720, height: 120 } });

  await page.goto('http://localhost:8731/roll.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.br-all .br-tile');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollBy(0, -260));
  await page.waitForTimeout(900);
  out.rollBar = await page.evaluate(() => Array.from(document.querySelectorAll('.br-bar .lg')).map(e => ({ id: e.id || e.className.split(' ')[0], mode: e.getAttribute('data-lg'), alpha: e.style.getPropertyValue('--lg-alpha') })));
  await page.screenshot({ path: '.claude/test/glass-bar-photos.png', clip: { x: 340, y: 800, width: 600, height: 100 } });

  // Mobile viewer with controls over a dark photo: pick the darkest tile by sampling thumbs
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:8731/roll.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.br-all .br-tile');
  await page.waitForTimeout(1200);
  const dark = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.br-all .br-tile img')].filter(i => i.complete && i.naturalWidth);
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d');
    let best = null, bl = 2;
    tiles.forEach(img => { try { x.drawImage(img, 0, 0, 8, 8); const d = x.getImageData(0,0,8,8).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])/255; s /= 64; if (s < bl) { bl = s; best = +img.parentNode.dataset.index; } } catch (e) {} });
    return { index: best, lum: bl };
  });
  out.darkTile = dark;
  await page.locator('.br-all .br-tile[data-index="' + dark.index + '"]').scrollIntoViewIfNeeded();
  await page.locator('.br-all .br-tile[data-index="' + dark.index + '"]').click();
  await page.waitForTimeout(1200);
  // Zoom in so the photo runs under the top and bottom controls
  await page.locator('#br-pages').dblclick({ position: { x: 195, y: 400 } });
  await page.waitForTimeout(900);
  // double-tap hides the controls; tap once to bring them back
  await page.locator('#br-pages').click({ position: { x: 100, y: 300 } });
  await page.waitForTimeout(900);
  out.viewer = await page.evaluate(() => Array.from(document.querySelectorAll('.br-viewer .lg')).map(e => ({ id: e.id || e.className.split(' ')[0], mode: e.getAttribute('data-lg'), alpha: e.style.getPropertyValue('--lg-alpha') })));
  await page.screenshot({ path: '.claude/test/glass-viewer-dark.png' });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
