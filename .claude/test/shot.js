const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:8731/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#cap-slider[data-state="ready"]');
  await page.locator('#cap-slider').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.locator('#gallery').screenshot({ path: '.claude/test/gallery-desktop.png' });

  // lightbox
  await page.locator('#cap-stage .cap[data-active="true"]').click({ position: { x: 140, y: 170 } });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.claude/test/lightbox.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#cap-slider').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('#gallery').screenshot({ path: '.claude/test/gallery-mobile.png' });
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
