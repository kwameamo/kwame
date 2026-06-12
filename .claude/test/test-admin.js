/* Drives the admin portal end-to-end against the mock server. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8731';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE + '/_p7n3x/', { waitUntil: 'networkidle' });
  const results = {};

  // ── Unlock (mock accepts any password) ──
  await page.fill('#lock-input', 'test');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#app.visible', { timeout: 5000 });
  results.unlocked = true;

  // Default view = Write
  results.defaultView = await page.evaluate(() =>
    ['post-wrap', 'list-wrap', 'gallery-wrap'].find(id => !document.getElementById(id).hidden));

  // ── Tab switching ──
  await page.click('#tab-gallery');
  await page.waitForTimeout(300);
  results.galleryTab = await page.evaluate(() => !document.getElementById('gallery-wrap').hidden
    && document.getElementById('post-wrap').hidden);

  await page.click('#tab-posts');
  await page.waitForTimeout(300);
  results.postsTab = await page.evaluate(() => !document.getElementById('list-wrap').hidden);

  // Gallery count badge from mock (5 items)
  results.galleryBadge = await page.textContent('#menu-gallery-count');

  // ── Gallery: queue 2 images with different captions ──
  await page.click('#tab-gallery');
  await page.waitForTimeout(300);

  // Generate two small test JPEGs via canvas in-page, then set them on the input.
  const fileInput = page.locator('#g-file');
  const mkJpeg = (color) => {
    // 64x80 solid jpeg via sharp-less raw approach: easiest is a tiny canvas in the page
    return page.evaluate((c) => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 80;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = c; ctx.fillRect(0, 0, 64, 80);
      return cv.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, color);
  };
  const b1 = Buffer.from(await mkJpeg('#cc4444'), 'base64');
  const b2 = Buffer.from(await mkJpeg('#4444cc'), 'base64');
  await fileInput.setInputFiles([
    { name: 'a.jpg', mimeType: 'image/jpeg', buffer: b1 },
    { name: 'b.jpg', mimeType: 'image/jpeg', buffer: b2 },
  ]);
  await page.waitForTimeout(800);

  results.queuedRows = await page.locator('#g-previews .g-pv').count();
  results.captionInputs = await page.locator('#g-previews .g-pv-cap').count();

  // Different captions per image
  await page.locator('#g-previews .g-pv-cap').nth(0).fill('First caption');
  await page.locator('#g-previews .g-pv-cap').nth(1).fill('Second caption');

  results.submitLabel = await page.textContent('#g-submit');

  // Capture upload payloads
  const payloads = [];
  await page.route('**/.netlify/functions/save-gallery', async (route) => {
    payloads.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"item":{"id":99}}' });
  });

  await page.click('#g-submit');
  await page.waitForTimeout(1500);

  results.uploads = payloads.length;
  results.captionsSent = payloads.map(p => p.caption);
  results.successShown = await page.evaluate(() =>
    document.getElementById('g-status').classList.contains('success'));
  results.queueCleared = await page.locator('#g-previews .g-pv').count();

  // ── Remove button on a freshly queued image ──
  await fileInput.setInputFiles([{ name: 'c.jpg', mimeType: 'image/jpeg', buffer: b1 }]);
  await page.waitForTimeout(600);
  await page.click('#g-previews .g-pv-x');
  await page.waitForTimeout(300);
  results.removeWorks = (await page.locator('#g-previews .g-pv').count()) === 0;

  // ── Screenshots ──
  await page.click('#tab-gallery');
  await page.screenshot({ path: '.claude/test/admin-gallery.png', fullPage: false });
  await page.click('#tab-post');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.claude/test/admin-write.png', fullPage: false });

  console.log(JSON.stringify(results, null, 2));
  if (errors.length) console.log('JS ERRORS:\n' + errors.join('\n'));
  await browser.close();
})().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
