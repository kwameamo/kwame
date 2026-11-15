/* Drives the home page, B-Roll and the blog reader in a real browser.
   Run `node .claude/test/serve.js` first (real photos are proxied from the live site). */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8731';
const OUT = '.claude/test/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  const results = {};

  // ── Home ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#br-preview .br-pv img', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  results.previewTiles = await page.locator('#br-preview a.br-pv').count();
  results.previewCount = await page.locator('#gallery-count').textContent();
  results.navAlpha = await page.evaluate(() => document.getElementById('site-nav').style.getPropertyValue('--lg-alpha'));
  results.navFilter = await page.evaluate(() => getComputedStyle(document.getElementById('site-nav')).backdropFilter.slice(0, 60));
  await page.screenshot({ path: OUT + 'home-top.png' });
  await page.locator('#gallery').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + 'home-broll.png' });
  results.navOverPhotosAlpha = await page.evaluate(() => document.getElementById('site-nav').style.getPropertyValue('--lg-alpha'));
  results.navOverPhotosMode = await page.evaluate(() => document.getElementById('site-nav').getAttribute('data-lg'));

  // ── Roll ──
  await page.goto(BASE + '/roll.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.br-all .br-tile', { timeout: 15000 });
  await page.waitForTimeout(1200);
  results.tiles = await page.locator('.br-all .br-tile').count();
  results.atBottom = await page.evaluate(() => window.scrollY > 0 || document.documentElement.scrollHeight <= window.innerHeight);
  results.sub = await page.locator('#br-sub').textContent();
  results.segAlpha = await page.evaluate(() => document.querySelector('.br-seg').style.getPropertyValue('--lg-alpha'));
  await page.screenshot({ path: OUT + 'roll-grid.png' });

  // Open the last tile
  const tiles = page.locator('.br-all .br-tile');
  const n = await tiles.count();
  await tiles.nth(n - 1).click();
  await page.waitForTimeout(900);
  results.viewerOpen = await page.evaluate(() => document.getElementById('br-viewer').classList.contains('is-open'));
  results.hash = await page.evaluate(() => location.hash);
  results.title = await page.locator('#br-title').textContent();
  results.when = await page.locator('#br-when').textContent();
  results.headMode = await page.evaluate(() => ({ mode: document.querySelector('.br-head').getAttribute('data-lg'), alpha: document.querySelector('.br-head').style.getPropertyValue('--lg-alpha') }));
  await page.screenshot({ path: OUT + 'roll-viewer.png' });

  // Prev arrow, then the menu
  await page.click('#br-prev');
  await page.waitForTimeout(700);
  results.hashAfterPrev = await page.evaluate(() => location.hash);
  await page.click('#br-more');
  await page.waitForTimeout(400);
  results.menuShown = await page.evaluate(() => document.getElementById('br-menu').classList.contains('is-shown'));
  await page.screenshot({ path: OUT + 'roll-menu.png' });
  await page.click('#br-copy');
  await page.waitForTimeout(300);
  results.toast = await page.locator('#br-toast-text').textContent();

  // Like, info
  await page.click('#br-like');
  await page.click('#br-info-btn');
  await page.waitForTimeout(600);
  results.infoText = (await page.locator('#br-info').innerText()).replace(/\s+/g, ' ').slice(0, 140);
  await page.screenshot({ path: OUT + 'roll-info.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  results.viewerClosed = await page.evaluate(() => !document.getElementById('br-viewer').classList.contains('is-open'));
  results.hearts = await page.locator('.br-tile__heart').count();

  // Library → Favorites
  await page.click('#br-library');
  await page.waitForTimeout(600);
  await page.click('.br-tab[data-tab="favorites"]');
  await page.waitForTimeout(600);
  results.favVisible = await page.locator('.br-all .br-tile:not([hidden])').count();
  results.favCount = await page.locator('.br-count').innerText();
  await page.screenshot({ path: OUT + 'roll-favorites.png' });
  await page.click('.br-tab[data-tab="library"]');
  await page.waitForTimeout(500);

  // Years / Months
  await page.click('.br-seg__btn[data-view="years"]');
  await page.waitForTimeout(600);
  results.yearCards = await page.locator('.br-years .br-card').count();
  await page.screenshot({ path: OUT + 'roll-years.png' });
  await page.click('.br-seg__btn[data-view="months"]');
  await page.waitForTimeout(600);
  results.monthCards = await page.locator('.br-months .br-card').count();
  await page.screenshot({ path: OUT + 'roll-months.png' });
  await page.click('.br-seg__btn[data-view="all"]');

  // Deep link
  await page.goto(BASE + '/roll.html#photo-' + results.hash.replace('#photo-', ''), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  results.deepLinkOpen = await page.evaluate(() => document.getElementById('br-viewer').classList.contains('is-open'));

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/roll.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.br-all .br-tile', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + 'roll-mobile.png' });
  const mt = page.locator('.br-all .br-tile');
  await mt.nth((await mt.count()) - 2).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + 'roll-mobile-viewer.png' });

  // ── Blog reader ──
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + '/blog.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.blog-card', { timeout: 15000 }).catch(() => {});
  const cards = await page.locator('.blog-card').count();
  if (cards) {
    await page.locator('.blog-card').first().click();
    await page.waitForTimeout(800);
    await page.evaluate(() => document.getElementById('blog-modal').scrollTo(0, 300));
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + 'blog-reader.png' });
    results.blogBtnFilter = await page.evaluate(() => getComputedStyle(document.querySelector('.modal-close')).backdropFilter.slice(0, 40));
  }

  // ── Case study nav ──
  await page.goto(BASE + '/work/fontdrop.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + 'case-study-nav.png', clip: { x: 0, y: 0, width: 1280, height: 160 } });
  results.csNavAlpha = await page.evaluate(() => document.getElementById('cs-nav').style.getPropertyValue('--lg-alpha'));

  console.log(JSON.stringify(results, null, 2));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
