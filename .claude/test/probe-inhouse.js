/* Captures the In-House section in both themes, on desktop and phone. */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  for (const f of ['photos/foldsvtg-logo.png', 'photos/foldsvtg-logo-dark.png']) {
    const b = fs.readFileSync(f);
    console.log(f, b.readUInt32BE(16) + 'x' + b.readUInt32BE(20), Math.round(b.length / 1024) + 'KB');
  }
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    for (const vp of [{ w: 1280, h: 900, n: 'desktop' }, { w: 390, h: 844, n: 'mobile' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: scheme });
      const p = await ctx.newPage();
      const errs = [];
      p.on('response', r => { if (r.status() >= 400 && !/email-decode/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
      await p.goto('http://localhost:8731/', { waitUntil: 'networkidle' });
      await p.evaluate(() => {
        document.querySelectorAll('.ab-reveal').forEach(e => e.classList.add('is-in'));
        const s = document.getElementById('brands');
        window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 70);
      });
      await p.waitForTimeout(1200);
      const logos = await p.evaluate(() => [...document.querySelectorAll('.hs-logo')].map(i => (i.currentSrc.split('/').pop()) + ' ' + i.naturalWidth + ' shown=' + (getComputedStyle(i).display !== 'none')));
      console.log(scheme, vp.n, logos.join(' | '), errs.length ? errs : '');
      await p.screenshot({ path: '.claude/test/inhouse-' + scheme + '-' + vp.n + '.png', fullPage: false });
      if (vp.n === 'mobile') {
        await p.evaluate(() => window.scrollBy(0, 700));
        await p.waitForTimeout(500);
        await p.screenshot({ path: '.claude/test/inhouse-' + scheme + '-mobile2.png' });
      }
      await ctx.close();
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
