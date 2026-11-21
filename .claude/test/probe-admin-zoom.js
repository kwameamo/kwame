/* Admin on iPhone: every text field is 16px or larger, so iOS never zooms on focus. */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext(Object.assign({}, devices['iPhone 15'], { serviceWorkers: 'block' }));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8731/_p7n3x/', { waitUntil: 'domcontentloaded' });
  // Put one row in the import list so its fields exist
  await p.evaluate(() => {
    const li = document.createElement('li');
    li.className = 'ad-imp';
    li.innerHTML = '<div class="ad-imp__fields"><input type="text"><input type="date"></div>';
    document.getElementById('si-list').appendChild(li);
  });
  const small = await p.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=file]):not([hidden]), textarea')]
    .map(e => ({ id: e.id || e.className || e.type, size: parseFloat(getComputedStyle(e).fontSize) }))
    .filter(x => x.size < 16));
  console.log('fields under 16px:', JSON.stringify(small));
  console.log('viewport:', await p.evaluate(() => document.querySelector('meta[name=viewport]').content));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
