import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

/*
  Visitor stats for the admin. POST { password, days }.
  Finished days are rolled up once into d/<day> and their raw views deleted;
  today is counted live from its raw views.
*/
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

const today = () => new Date().toISOString().slice(0, 10);
const dayList = (n) => {
  const out = [], t = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(t - i * 86400000).toISOString().slice(0, 10));
  return out;
};

async function readEvents(store, day) {
  const { blobs } = await store.list({ prefix: `e/${day}/` });
  const events = [];
  for (let i = 0; i < blobs.length; i += 40) {
    const batch = await Promise.all(blobs.slice(i, i + 40).map((b) => store.get(b.key, { type: 'json' }).catch(() => null)));
    batch.forEach((e) => { if (e) events.push(e); });
  }
  return { keys: blobs.map((b) => b.key), events };
}

const bump = (map, k, n = 1) => { if (k) map[k] = (map[k] || 0) + n; };

// One day's views -> a summary. Sources, countries and devices count people
// (each visitor's first view of the day); pages count views.
function summarise(events) {
  events.sort((a, b) => a.t - b.t);
  const s = { views: events.length, visitors: 0, pages: {}, sources: {}, countries: {}, cities: {}, devices: {}, names: {} };
  const seen = new Set();
  for (const e of events) {
    bump(s.pages, e.p);
    if (seen.has(e.v)) continue;
    seen.add(e.v);
    bump(s.sources, e.s || 'Direct');
    bump(s.countries, e.c || '??');
    if (e.c && e.cn) s.names[e.c] = e.cn;
    if (e.ci) bump(s.cities, e.ci + (e.c ? ', ' + e.c : ''));
    bump(s.devices, e.d || 'Computer');
  }
  s.visitors = seen.size;
  return s;
}

async function compact(store, day) {
  const { keys, events } = await readEvents(store, day);
  const sum = summarise(events);
  await store.setJSON(`d/${day}`, sum);
  for (let i = 0; i < keys.length; i += 40) await Promise.all(keys.slice(i, i + 40).map((k) => store.delete(k).catch(() => {})));
  return sum;
}

const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);

export default async (req, context) => {
  const ip = context?.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  const { limited, retryAfter } = await checkRateLimit(ip);
  if (limited) return json({ error: 'Too many failed attempts. Try again later.' }, 429, { 'Retry-After': String(retryAfter) });

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (!body.password || body.password !== process.env.ADMIN_PASSWORD) {
    await recordFailure(ip);
    return json({ error: 'Wrong password.' }, 401);
  }
  await clearRateLimit(ip);

  const n = Math.min(90, Math.max(1, parseInt(body.days, 10) || 7));
  const store = getStore({ name: 'stats', consistency: 'strong' });
  const now = today();

  try {
    // Roll up every finished day that still has raw views, inside the range or not.
    const { directories } = await store.list({ prefix: 'e/', directories: true });
    for (const dir of directories || []) {
      const day = dir.replace(/^e\//, '').replace(/\/$/, '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < now) {
        const existing = await store.get(`d/${day}`, { type: 'json' });
        if (!existing) await compact(store, day);
        else { // late views for a day already rolled up: fold them in
          const { keys, events } = await readEvents(store, day);
          if (events.length) {
            const extra = summarise(events);
            existing.views += extra.views; existing.visitors += extra.visitors;
            for (const f of ['pages', 'sources', 'countries', 'cities', 'devices']) for (const [k, v] of Object.entries(extra[f])) bump(existing[f], k, v);
            Object.assign(existing.names, extra.names);
            await store.setJSON(`d/${day}`, existing);
            await Promise.all(keys.map((k) => store.delete(k).catch(() => {})));
          }
        }
      }
    }

    const days = dayList(n);
    const live = await readEvents(store, now);
    const totals = { views: 0, visitors: 0, pages: {}, sources: {}, countries: {}, cities: {}, devices: {}, names: {} };
    const series = [];
    for (const day of days) {
      const s = day === now ? summarise(live.events.slice()) : (await store.get(`d/${day}`, { type: 'json' })) || summarise([]);
      series.push({ date: day, views: s.views, visitors: s.visitors });
      totals.views += s.views; totals.visitors += s.visitors;
      for (const f of ['pages', 'sources', 'countries', 'cities', 'devices']) for (const [k, v] of Object.entries(s[f] || {})) bump(totals[f], k, v);
      Object.assign(totals.names, s.names || {});
    }

    const fiveAgo = Date.now() - 5 * 60 * 1000;
    const nowVisitors = new Set(live.events.filter((e) => e.t >= fiveAgo).map((e) => e.v)).size;
    const recent = live.events.sort((a, b) => b.t - a.t).slice(0, 15)
      .map((e) => ({ t: e.t, p: e.p, s: e.s, c: e.c, cn: e.cn, ci: e.ci, d: e.d }));

    return json({
      days: n,
      series,
      views: totals.views,
      visitors: totals.visitors,
      now: nowVisitors,
      pages: top(totals.pages, 10),
      sources: top(totals.sources, 10),
      countries: top(totals.countries, 10).map(([code, count]) => [code, totals.names[code] || (code === '??' ? 'Unknown' : code), count]),
      cities: top(totals.cities, 8),
      devices: top(totals.devices, 3),
      recent,
    });
  } catch (err) {
    return json({ error: 'Could not read stats.' }, 500);
  }
};
