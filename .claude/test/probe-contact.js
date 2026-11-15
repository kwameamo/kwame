/* Contact form validation and layout, About and In-House, in both themes. */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    for (const vp of [{ w: 1280, h: 900, n: 'desktop' }, { w: 390, h: 844, n: 'mobile' }]) {
      const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: scheme });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      // Never post to the real form service from a test
      await p.route('https://api.web3forms.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
      await p.goto('http://localhost:8731/', { waitUntil: 'networkidle' });
      await p.evaluate(() => document.querySelectorAll('.ab-reveal').forEach(e => e.classList.add('is-in')));
      for (const id of ['about', 'inquire']) {
        await p.evaluate(i => { const s = document.getElementById(i); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 70); }, id);
        await p.waitForTimeout(500);
        await p.screenshot({ path: `.claude/test/c-${id}-${scheme}-${vp.n}.png` });
      }
      if (scheme === 'light' && vp.n === 'desktop') {
        await p.click('#f-submit-btn');
        await p.waitForTimeout(300);
        const msg = await p.textContent('#f-invalid');
        await p.screenshot({ path: '.claude/test/c-invalid.png' });
        await p.fill('#f-first', 'Ama'); await p.fill('#f-last', 'Mensah'); await p.fill('#f-email', 'ama@example.com');
        await p.click('.ct-chip:has-text("Website")');
        await p.click('.ct-chip:has-text("Not sure yet")');
        await p.fill('#f-message', 'A site for my studio.');
        await p.screenshot({ path: '.claude/test/c-filled.png' });
        await p.click('#f-submit-btn');
        await p.waitForTimeout(800);
        const sent = await p.evaluate(() => !document.getElementById('f-success').hidden && document.getElementById('inquire-form').hidden);
        console.log('validation:', msg, '| sent:', sent);
      }
      console.log(scheme, vp.n, errs.length ? errs : 'ok');
      await ctx.close();
    }
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
