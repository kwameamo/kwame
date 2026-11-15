/* Drives the Notes blog, the About section and the admin in a real browser.
   Run `node .claude/test/serve.js` first. Admin writes hit the mock endpoints. */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8731';
const OUT = '.claude/test/';

(async () => {
  const browser = await chromium.launch();
  const out = {};
  const errors = [];
  async function newPage(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts || {}));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !/email-decode/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
    return page;
  }

  // ── Blog, light and dark ──
  for (const scheme of ['light', 'dark']) {
    const page = await newPage({ colorScheme: scheme, viewport: { width: 430, height: 932 } });
    await page.goto(BASE + '/blog.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.nt-row');
    await page.waitForTimeout(700);
    out['blogRows_' + scheme] = await page.locator('.nt-row').count();
    out['blogGroups_' + scheme] = await page.locator('.nt-group__hd').allTextContents();
    await page.screenshot({ path: OUT + 'notes-list-' + scheme + '.png' });
    if (scheme === 'dark') {
      await page.fill('#nt-q', 'system');
      await page.waitForTimeout(300);
      out.searchGroups = await page.locator('.nt-group__hd').allTextContents();
      out.searchMarks = await page.locator('.nt-row mark').count();
      await page.screenshot({ path: OUT + 'notes-search.png' });
      await page.fill('#nt-q', '');
      await page.waitForTimeout(200);
    }
    await page.locator('.nt-row').first().click();
    await page.waitForTimeout(700);
    out['readerOpen_' + scheme] = await page.evaluate(() => document.getElementById('nt-reader').classList.contains('is-open'));
    out['readerUrl_' + scheme] = await page.evaluate(() => location.search);
    await page.screenshot({ path: OUT + 'notes-reader-' + scheme + '.png' });
    await page.click('#nt-down');
    await page.waitForTimeout(400);
    out['afterDown_' + scheme] = await page.evaluate(() => location.search);
    await page.goBack();
    await page.waitForTimeout(600);
    out['afterBack_' + scheme] = await page.evaluate(() => ({ open: document.getElementById('nt-reader').classList.contains('is-open'), q: location.search }));
    await page.context().close();
  }
  // Deep link
  {
    const page = await newPage();
    await page.goto(BASE + '/blog.html?post=3', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    out.deepLink = await page.evaluate(() => ({ open: document.getElementById('nt-reader').classList.contains('is-open'), title: document.getElementById('nt-r-title').textContent }));
    await page.screenshot({ path: OUT + 'notes-reader-desktop.png' });
    await page.click('#nt-back');
    await page.waitForTimeout(600);
    out.deepLinkBack = await page.evaluate(() => ({ open: document.getElementById('nt-reader').classList.contains('is-open'), q: location.search }));
    await page.context().close();
  }

  // ── About ──
  for (const vp of [{ width: 1280, height: 900, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
    const page = await newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.locator('#about').scrollIntoViewIfNeeded();
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(150); }
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    out['aboutRevealed_' + vp.name] = await page.evaluate(() => [document.querySelectorAll('.ab-reveal').length, document.querySelectorAll('.ab-reveal.is-in').length]);
    await page.locator('#about').screenshot({ path: OUT + 'about-' + vp.name + '.png' });
    await page.context().close();
  }

  // ── Admin ──
  {
    const page = await newPage({ viewport: { width: 430, height: 932 } });
    await page.goto(BASE + '/_p7n3x/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: OUT + 'admin-lock.png' });
    await page.fill('#lock-input', 'test');
    await page.press('#lock-input', 'Enter');
    await page.waitForSelector('#app:not([hidden])');
    await page.waitForSelector('#notes-list .ad-row');
    await page.waitForTimeout(800);
    out.adminNotes = await page.locator('#notes-list .ad-row').count();
    await page.screenshot({ path: OUT + 'admin-notes.png' });

    // Edit an existing note
    await page.locator('#notes-list .ad-row').first().click();
    await page.waitForTimeout(700);
    out.editorMd = (await page.inputValue('#ed-body')).slice(0, 160);
    out.saveDisabledClean = await page.locator('#ed-save').isDisabled();
    await page.locator('#ed-body').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    out.saveDisabledDirty = await page.locator('#ed-save').isDisabled();
    await page.screenshot({ path: OUT + 'admin-editor.png' });
    await page.click('#ed-info');
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + 'admin-note-details.png' });
    await page.click('#sheet-note [data-close].ad-btn');
    await page.waitForTimeout(400);
    await page.click('#ed-back');
    await page.waitForTimeout(600);
    out.draftShown = await page.locator('.ad-row__draft').count();

    // A new note, with formatting
    await page.click('#act-new');
    await page.waitForTimeout(600);
    await page.fill('#ed-title', 'Test note');
    await page.locator('#ed-body').click();
    await page.keyboard.type('- one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two');
    out.listContinue = await page.inputValue('#ed-body');
    await page.click('#ed-save');
    await page.waitForTimeout(800);
    out.toast = await page.locator('#toast-text').textContent();
    await page.click('#ed-back');
    await page.waitForTimeout(500);

    // B-Roll
    await page.click('.ad-tab[data-view="view-roll"]');
    await page.waitForSelector('#roll-grid .ad-tile');
    await page.waitForTimeout(1200);
    out.adminTiles = await page.locator('#roll-grid .ad-tile').count();
    out.slowBanner = await page.locator('#thumb-title').textContent();
    await page.screenshot({ path: OUT + 'admin-roll.png' });
    await page.locator('#roll-grid .ad-tile').last().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + 'admin-photo.png' });
    await page.click('#sheet-photo [data-close].ad-btn');
    await page.waitForTimeout(400);

    // Import sheet with a generated JPEG
    await page.setInputFiles('#roll-file', { name: 'test.jpg', mimeType: 'image/jpeg', buffer: require('fs').readFileSync('photos/chic-curls-cover.jpg') });
    await page.waitForTimeout(800);
    out.importRows = await page.locator('.ad-imp').count();
    out.importDate = await page.locator('.ad-imp input[type=date]').inputValue();
    await page.screenshot({ path: OUT + 'admin-import.png' });
    await page.context().close();
  }

  // Desktop admin, dark
  {
    const page = await newPage({ colorScheme: 'dark' });
    await page.goto(BASE + '/_p7n3x/', { waitUntil: 'networkidle' });
    await page.fill('#lock-input', 'test');
    await page.press('#lock-input', 'Enter');
    await page.waitForSelector('#notes-list .ad-row');
    await page.waitForTimeout(800);
    await page.screenshot({ path: OUT + 'admin-notes-dark.png' });
    await page.context().close();
  }

  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
