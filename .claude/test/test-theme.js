/* Flips every page to dark with its own switch and captures it. */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8731';
const OUT = '.claude/test/';
(async () => {
  const browser = await chromium.launch();
  const out = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const scheme = () => page.evaluate(() => document.documentElement.getAttribute('data-scheme'));

  // Home: switch in the nav
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  out.homeStart = await scheme();
  await page.click('.nav-links [data-theme-toggle]');
  await page.waitForTimeout(700);
  out.homeAfter = await scheme();
  out.stored = await page.evaluate(() => localStorage.getItem('theme'));
  out.bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.screenshot({ path: OUT + 'dark-home-top.png' });
  await page.evaluate(() => document.getElementById('work').scrollIntoView());
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + 'dark-home-work.png' });
  await page.evaluate(() => { const a = document.getElementById('about'); a.querySelectorAll('.ab-reveal').forEach(e => e.classList.add('is-in')); a.scrollIntoView(); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + 'dark-home-about.png', fullPage: false });
  await page.evaluate(() => document.getElementById('brands').scrollIntoView());
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + 'dark-home-brands.png' });

  // The choice carries to every other page, with no white first paint
  for (const p of ['/roll.html', '/blog.html', '/work/fontdrop.html', '/404.html', '/_p7n3x/']) {
    await page.goto(BASE + p, { waitUntil: 'commit' });
    out['first:' + p] = await page.evaluate(() => document.documentElement.getAttribute('data-scheme'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + 'dark' + p.replace(/[^a-z0-9]+/gi, '-') + '.png' });
  }
  // B-Roll viewer in dark
  await page.goto(BASE + '/roll.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.br-all .br-tile');
  await page.waitForTimeout(800);
  await page.locator('.br-all .br-tile').last().click();
  await page.waitForTimeout(900);
  await page.click('#br-info-btn');
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + 'dark-roll-info.png' });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // Switch back from the roll's own button
  await page.click('.br-theme');
  await page.waitForTimeout(600);
  out.rollBackToLight = await scheme();
  out.storedAfterReturn = await page.evaluate(() => localStorage.getItem('theme'));
  // Blog menu switch
  await page.goto(BASE + '/blog.html', { waitUntil: 'networkidle' });
  await page.click('#nt-more');
  await page.waitForTimeout(300);
  out.blogMenuLabel = await page.locator('#nt-menu [data-theme-toggle] span').textContent();
  await page.click('#nt-menu [data-theme-toggle]');
  await page.waitForTimeout(600);
  out.blogAfter = await scheme();
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
