/* Drives the homepage gallery with a real browser and reports what works. */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8731';

async function activeIndex(page) {
  return page.evaluate(() => {
    const caps = [...document.querySelectorAll('#cap-stage .cap')];
    return caps.findIndex(c => c.getAttribute('data-active') === 'true');
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#cap-slider[data-state="ready"]', { timeout: 8000 })
    .catch(() => { console.log('FAIL: slider never reached ready state'); });

  const results = {};

  // Scroll the gallery into view (autoplay/keys depend on visibility; clicks need it too)
  await page.locator('#cap-slider').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);

  results.cards = await page.locator('#cap-stage .cap').count();
  results.initialActive = await activeIndex(page);

  // ── Next arrow ──
  await page.click('#cap-next');
  await page.waitForTimeout(700);
  const afterNext = await activeIndex(page);
  results.nextWorks = afterNext === (results.initialActive + 1) % results.cards;
  results.afterNext = afterNext;

  // ── Prev arrow ──
  await page.click('#cap-prev');
  await page.waitForTimeout(700);
  const afterPrev = await activeIndex(page);
  results.prevWorks = afterPrev === results.initialActive;
  results.afterPrev = afterPrev;

  // ── What element actually sits on top of the arrows? ──
  results.hitTest = await page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return top ? (top.id || top.className || top.tagName) : 'none';
    };
    return { prev: r(document.getElementById('cap-prev')), next: r(document.getElementById('cap-next')) };
  });

  // ── Tap front card → lightbox ──
  const front = page.locator('#cap-stage .cap[data-active="true"]');
  await front.click({ position: { x: 100, y: 100 } });
  await page.waitForTimeout(500);
  results.lightboxOpens = await page.evaluate(() => {
    const lb = document.getElementById('cap-lightbox');
    return lb && !lb.hidden && lb.classList.contains('show');
  });

  if (results.lightboxOpens) {
    results.lightboxImgVisible = await page.evaluate(() => {
      const img = document.getElementById('cap-lb-img');
      const r = img.getBoundingClientRect();
      return r.width > 50 && r.height > 50;
    });
    // Close via backdrop (bottom-left, clear of the lightbox nav buttons)
    await page.mouse.click(60, 780);
    await page.waitForTimeout(500);
    results.lightboxCloses = await page.evaluate(() => document.getElementById('cap-lightbox').hidden);
  }

  // ── Caption: below the deck, full text, wraps (id 1 has the long caption) ──
  await page.evaluate(() => {
    // jump to image id 1 (index of items order = newest first in real data; mock keeps order)
    const dots = document.querySelectorAll('#cap-dots .cap-dot');
    if (dots[0]) dots[0].click();
  });
  await page.waitForTimeout(700);
  results.caption = await page.evaluate(() => {
    const cap = document.getElementById('cap-active-caption');
    if (!cap) return { exists: false };
    const style = getComputedStyle(cap);
    const r = cap.getBoundingClientRect();
    const stage = document.getElementById('cap-stage').getBoundingClientRect();
    return {
      exists: true,
      text: cap.textContent,
      fullTextShown: cap.textContent.length > 60,
      horizTruncated: cap.scrollWidth > cap.clientWidth + 1,
      wraps: style.whiteSpace === 'normal',
      belowDeck: r.top >= stage.bottom,
      gapFromDeck: Math.round(r.top - stage.bottom),
      visibleHeight: Math.round(r.height),
    };
  });

  // ── Drag-follow swipe ──
  const before = await activeIndex(page);
  const stageBox = await page.locator('#cap-stage').boundingBox();
  await page.mouse.move(stageBox.x + stageBox.width / 2 + 80, stageBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width / 2 - 40, stageBox.y + 100, { steps: 6 });
  // Mid-drag: deck should be tracking (dragging class on, cards mid-pose)
  results.dragFollow = await page.evaluate(() => {
    const stage = document.getElementById('cap-stage');
    const front = stage.querySelector('.cap');
    return stage.classList.contains('dragging');
  });
  await page.mouse.move(stageBox.x + stageBox.width / 2 - 120, stageBox.y + 100, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  results.swipeWorks = (await activeIndex(page)) !== before;

  // Small drag should snap back, not flip
  const snapBefore = await activeIndex(page);
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width / 2 - 30, stageBox.y + 100, { steps: 4 });
  await page.waitForTimeout(350); // slow release so velocity is low
  await page.mouse.up();
  await page.waitForTimeout(800);
  results.snapBackWorks = (await activeIndex(page)) === snapBefore;

  // ── Ghost blur on backdrop cards ──
  results.ghostBlur = await page.evaluate(() => {
    const caps = [...document.querySelectorAll('#cap-stage .cap')];
    const back = caps.find(c => c.getAttribute('data-active') === 'false' &&
      parseFloat(getComputedStyle(c).opacity) > 0.05);
    if (!back) return { found: false };
    const f = getComputedStyle(back).filter;
    return { found: true, filter: f, blurred: /blur\((?!0px)/.test(f) };
  });

  // ── Lightbox prev/next ──
  const lbFront = page.locator('#cap-stage .cap[data-active="true"]');
  await lbFront.click({ position: { x: 100, y: 100 } });
  await page.waitForTimeout(500);
  const srcA = await page.getAttribute('#cap-lb-img', 'src');
  await page.click('#cap-lb-next');
  await page.waitForTimeout(500);
  const srcB = await page.getAttribute('#cap-lb-img', 'src');
  results.lbNextWorks = srcA !== srcB;
  await page.click('#cap-lb-prev');
  await page.waitForTimeout(500);
  results.lbPrevWorks = (await page.getAttribute('#cap-lb-img', 'src')) === srcA;
  // Deck synced behind lightbox + keyboard nav inside lightbox
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  results.lbKeyboardWorks = (await page.getAttribute('#cap-lb-img', 'src')) === srcB;
  results.deckSynced = (await activeIndex(page)) !== -1;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  results.lbEscCloses = await page.evaluate(() => document.getElementById('cap-lightbox').hidden);

  // ── Dots ──
  results.dots = await page.locator('#cap-dots .cap-dot').count();
  if (results.dots > 2) {
    await page.locator('#cap-dots .cap-dot').nth(2).click();
    await page.waitForTimeout(700);
    results.dotWorks = (await activeIndex(page)) === 2;
  }

  // ── Mobile viewport sanity ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.locator('#cap-slider').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  results.mobileHit = await page.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return top ? (top.id || top.className || top.tagName) : 'none';
    };
    return { prev: r(document.getElementById('cap-prev')), next: r(document.getElementById('cap-next')) };
  });
  const mBefore = await activeIndex(page);
  await page.click('#cap-next');
  await page.waitForTimeout(700);
  results.mobileNextWorks = (await activeIndex(page)) === (mBefore + 1) % results.cards;

  console.log(JSON.stringify(results, null, 2));
  if (errors.length) console.log('JS ERRORS:\n' + errors.join('\n'));
  await browser.close();
})().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
