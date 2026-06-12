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

  // No marquee, no footer label
  results.noTicker = await page.evaluate(() => !document.querySelector('.ft-ticker'));
  results.noKicker = await page.evaluate(() => !document.querySelector('.ft-kicker'));

  // Clock with seconds
  await page.waitForTimeout(1100);
  const clockA = await page.textContent('#ft-clock');
  results.clockFormat = /^\d{2}:\d{2}:\d{2} GMT$/.test(clockA);
  await page.waitForTimeout(2100);
  results.clockTicksSeconds = (await page.textContent('#ft-clock')) !== clockA;

  // Scroll to footer → statement decodes back to the original text
  const original = 'Culture, code & commerce — designed in Koforidua, shipped worldwide.';
  await page.locator('#footer').scrollIntoViewIfNeeded();
  await page.waitForSelector('#ft-line[data-fx-done="1"]', { timeout: 6000 })
    .catch(() => {});
  results.decodeDone = await page.evaluate(() =>
    document.getElementById('ft-line').dataset.fxDone === '1');
  results.decodeTextRestored = (await page.textContent('#ft-line')) === original;

  // Reveals settled
  await page.waitForTimeout(900);
  results.revealsSettled = await page.evaluate(() =>
    [...document.querySelectorAll('.ft-reveal')].every(el =>
      parseFloat(getComputedStyle(el).opacity) > 0.95));

  // Orb: difference blend, scales up on entry, follows the cursor
  results.orbBlend = await page.evaluate(() =>
    getComputedStyle(document.getElementById('ft-orb')).mixBlendMode === 'difference');
  const fr = await page.locator('#footer').boundingBox();
  await page.mouse.move(fr.x + 300, fr.y + 200);
  await page.waitForTimeout(600);
  const orbT1 = await page.evaluate(() => document.getElementById('ft-orb').style.transform);
  await page.mouse.move(fr.x + 800, fr.y + 300, { steps: 5 });
  await page.waitForTimeout(700);
  const orbT2 = await page.evaluate(() => document.getElementById('ft-orb').style.transform);
  results.orbFollows = !!orbT1 && !!orbT2 && orbT1 !== orbT2;
  results.orbVisible = await page.evaluate(() => {
    const m = document.getElementById('ft-orb').style.transform.match(/scale\(([\d.]+)\)/);
    return m ? parseFloat(m[1]) > 0.5 : false;
  });

  // HUD readout tracks the orb
  results.hud = await page.evaluate(() => {
    const h = document.getElementById('ft-hud');
    return { on: h.classList.contains('on'), text: h.textContent,
      format: /^✦ \d{4} × \d{4}$/.test(h.textContent) };
  });

  // Self-drawing star completed
  results.starDrawn = await page.evaluate(() => {
    const p = document.getElementById('ft-sig-path');
    return p && p.style.strokeDashoffset === '0px' || p.style.strokeDashoffset === '0';
  });

  // Nav link: label decode restores text, index slides in on hover
  const linkLabel = await page.textContent('.footer-nav-link .ft-li-label');
  await page.hover('.footer-nav-link');
  await page.waitForTimeout(700);
  results.linkDecodeRestored =
    (await page.textContent('.footer-nav-link .ft-li-label')) === linkLabel;
  results.idxVisibleOnHover = await page.evaluate(() => {
    const idx = document.querySelector('.footer-nav-link:hover .ft-li-idx');
    return idx ? parseFloat(getComputedStyle(idx).opacity) > 0.8 : false;
  });
  results.idxCount = await page.locator('.ft-li-idx').count();

  // Brand decode restores
  const brandText = await page.textContent('.footer-brand');
  await page.hover('.footer-brand');
  await page.waitForTimeout(800);
  results.brandDecodeRestored = (await page.textContent('.footer-brand')) === brandText;

  // Hero clock has seconds too
  results.heroClockSeconds = await page.evaluate(() =>
    /^\d{2}:\d{2}:\d{2}$/.test(document.getElementById('hero-clock').textContent));

  // Magnetic CTA
  const cta = page.locator('.footer-cta');
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width - 4, box.y + 2);
  await page.waitForTimeout(400);
  results.magnetic = await page.evaluate(() => {
    const t = getComputedStyle(document.querySelector('.footer-cta')).transform;
    if (t === 'none') return false;
    const m = new DOMMatrix(t);
    return Math.abs(m.m41) > 0.5 || Math.abs(m.m42) > 0.5;
  });

  // Back to top
  await page.click('#ft-top');
  await page.waitForTimeout(3000);
  results.backToTop = await page.evaluate(() => window.scrollY < 50);

  // Screenshots (orb mid-footer for the desktop shot)
  await page.locator('#footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const fr2 = await page.locator('#footer').boundingBox();
  await page.mouse.move(fr2.x + 420, fr2.y + 170);
  await page.waitForTimeout(900);
  await page.locator('#footer').screenshot({ path: '.claude/test/footer-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.locator('#footer').screenshot({ path: '.claude/test/footer-mobile.png' });

  console.log(JSON.stringify(results, null, 2));
  if (errors.length) console.log('JS ERRORS:\n' + errors.join('\n'));
  await browser.close();
})().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
