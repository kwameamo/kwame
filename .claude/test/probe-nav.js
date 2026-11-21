/* Header on iPhone widths: every nav item must sit on one row. */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  const base = process.argv[2] || 'http://localhost:8731';
  for (const dev of ['iPhone SE', 'iPhone 15', 'iPhone 15 Pro Max']) {
    for (const path of ['/', '/work/chic-curls.html']) {
      const ctx = await b.newContext(Object.assign({}, devices[dev], { serviceWorkers: 'block' }));
      const p = await ctx.newPage();
      await p.goto(base + path, { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const items = [...document.querySelectorAll('.nav-links > li, .cs-nav-inner > *, .cs-nav-end > *')];
        const tops = [...new Set(items.map(e => Math.round(e.getBoundingClientRect().top)))];
        const nav = document.querySelector('.site-nav, .cs-nav').getBoundingClientRect();
        return { rows: tops.length, navH: Math.round(nav.height), navW: Math.round(nav.width) };
      });
      console.log(dev.padEnd(18), path.padEnd(24), JSON.stringify(r));
      if (dev === 'iPhone SE') await p.screenshot({ path: '.claude/test/nav' + path.replace(/\W/g, '_') + '.png', clip: { x: 0, y: 0, width: 375, height: 90 } });
      await ctx.close();
    }
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
