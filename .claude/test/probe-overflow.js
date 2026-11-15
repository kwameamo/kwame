/* In-House tiles on an iPhone-sized WebKit (Safari's engine): no plate may poke past its tile. */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext(Object.assign({}, devices['iPhone 15'], { colorScheme: scheme, serviceWorkers: 'block' }));
    const p = await ctx.newPage();
    const url = process.argv[2] || 'http://localhost:8731/';
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.querySelectorAll('.ab-reveal').forEach(e => e.classList.add('is-in')));
    await p.evaluate(() => { const s = document.getElementById('brands'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 60); });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const page = document.documentElement.clientWidth;
      return [...document.querySelectorAll('.hs-tile')].map(t => {
        const tb = t.getBoundingClientRect(), pb = t.querySelector('.hs-plate').getBoundingClientRect();
        return { tile: Math.round(tb.right), plate: Math.round(pb.right), over: Math.round(pb.right - tb.right + 8), pastPage: tb.right > page + 0.5 };
      });
    });
    console.log(scheme, url.includes('kwame.vision') ? 'LIVE' : 'local', JSON.stringify(r));
    await p.screenshot({ path: '.claude/test/overflow-' + scheme + (url.includes('kwame.vision') ? '-live' : '') + '.png' });
    await p.evaluate(() => window.scrollBy(0, 560));
    await p.waitForTimeout(300);
    await p.screenshot({ path: '.claude/test/overflow-' + scheme + (url.includes('kwame.vision') ? '-live' : '') + '-2.png' });
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
