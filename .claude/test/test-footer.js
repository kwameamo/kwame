/* Verifies the footer motion layer in a real browser. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://localhost:8731/', { waitUntil: 'networkidle' });
  const results = {};

  results.gsapLoaded = await page.evaluate(() =>
    typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined');

  // Scroll to footer to fire ScrollTrigger reveals
  await page.locator('#footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);

  // Ticker animating
  results.ticker = await page.evaluate(() => {
    const track = document.querySelector('.ft-ticker-track');
    const s = getComputedStyle(track);
    return { animating: s.animationName === 'ft-marquee' && s.animationPlayState === 'running' };
  });

  // Statement words split + revealed
  results.statement = await page.evaluate(() => {
    const line = document.getElementById('ft-line');
    const words = line.querySelectorAll('.ft-w-in');
    const first = words[0] && getComputedStyle(words[0]);
    return {
      wordCount: words.length,
      revealed: words.length > 0 &&
        Math.abs(new DOMMatrix(first.transform === 'none' ? undefined : first.transform).m42) < 1,
      fullText: line.textContent.includes('worldwide'),
    };
  });

  // Reveals finished at full opacity / no offset
  results.revealsSettled = await page.evaluate(() => {
    return [...document.querySelectorAll('.ft-reveal')].every(el => {
      const s = getComputedStyle(el);
      return parseFloat(s.opacity) > 0.95;
    });
  });

  // Clock shows a real time
  results.clock = await page.textContent('#ft-clock');

  // Magnetic CTA: hover should move it
  const cta = page.locator('.footer-cta');
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width - 4, box.y + 2);
  await page.waitForTimeout(400);
  results.magnetic = await page.evaluate(() => {
    const el = document.querySelector('.footer-cta');
    const t = getComputedStyle(el).transform;
    if (t === 'none') return { moved: false };
    const m = new DOMMatrix(t);
    return { moved: Math.abs(m.m41) > 0.5 || Math.abs(m.m42) > 0.5 };
  });
  await page.mouse.move(box.x - 200, box.y - 200);
  await page.waitForTimeout(900);

  // Back to top
  await page.click('#ft-top');
  await page.waitForTimeout(3000);
  results.backToTop = await page.evaluate(() => window.scrollY < 50);

  // Screenshots
  await page.locator('#footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.locator('#footer').screenshot({ path: '.claude/test/footer-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.locator('#footer').screenshot({ path: '.claude/test/footer-mobile.png' });

  console.log(JSON.stringify(results, null, 2));
  if (errors.length) console.log('JS ERRORS:\n' + errors.join('\n'));
  await browser.close();
})().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
