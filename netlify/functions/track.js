import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';

/*
  Records one page view from /js/track.js.
  No cookies and no IP addresses are stored. A visitor is a hash of
  IP + browser + a salt that changes every day, so the same person counts
  once per day and can't be followed from one day to the next.
  Each view is its own small blob (e/<day>/<time>-<random>), so two views
  arriving together never overwrite each other. get-stats rolls finished
  days up into one summary.
*/
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python|go-http|axios|node-fetch|okhttp|java\//i;

const SOURCE_NAMES = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)facebook\.com$|^fb\.me$/, 'Facebook'],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, 'X'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)behance\.net$/, 'Behance'],
  [/(^|\.)pinterest\./, 'Pinterest'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android\.googlequicksearchbox$/, 'Google'],
  [/^com\.google\.android\.gm$/, 'Gmail'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, 'WhatsApp'],
  [/(^|\.)snapchat\.com$/, 'Snapchat'],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, 'ChatGPT'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
];

// Short ?ref= / ?utm_source= tags, e.g. kwame.vision/?ref=ig in a bio link.
const TAGS = {
  ig: 'Instagram', instagram: 'Instagram', fb: 'Facebook', facebook: 'Facebook',
  x: 'X', tw: 'X', twitter: 'X', li: 'LinkedIn', linkedin: 'LinkedIn', be: 'Behance', behance: 'Behance',
  tiktok: 'TikTok', tt: 'TikTok', yt: 'YouTube', youtube: 'YouTube', wa: 'WhatsApp', whatsapp: 'WhatsApp',
  pin: 'Pinterest', pinterest: 'Pinterest', gh: 'GitHub', github: 'GitHub', email: 'Email', cv: 'CV', qr: 'QR code',
};

function sourceName(host) {
  for (const [re, name] of SOURCE_NAMES) if (re.test(host)) return name;
  return host;
}

// Only paths shaped like this site's pages (/, /blog.html, /work/ghana-duty.html …).
const PAGE = /^\/(?:[a-z0-9-]+\/)*(?:[a-z0-9-]+(?:\.html)?)?$/i;

function cleanPath(p) {
  if (typeof p !== 'string') return null;
  p = p.split(/[?#]/)[0];
  if (p.length > 120 || !PAGE.test(p)) return null;
  if (p === '/index.html') p = '/';
  return p;
}

// A random salt made once and kept in the store, so visitor ids never involve
// any real secret. Cached for the life of the function instance.
let saltCache = null;
async function getSalt(store) {
  if (saltCache) return saltCache;
  let s = await store.get('salt');
  if (!s) { s = randomBytes(32).toString('hex'); await store.set('salt', s); }
  return (saltCache = s);
}

export default async (req, context) => {
  const done = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua)) return done();

  // Browsers send Origin with the beacon: only count views sent from this site.
  const origin = req.headers.get('origin');
  if (origin) {
    try { if (new URL(origin).host !== new URL(req.url).host) return done(); } catch { return done(); }
  }

  let d;
  try { d = JSON.parse(await req.text()); } catch { return done(); }
  if (!d || typeof d !== 'object') return done();

  const path = cleanPath(d.p);
  if (!path || path.startsWith('/_p7n3x')) return done();

  // Where they came from: a ?utm_source / ?ref tag wins, then the referring site.
  // Moving between pages of this site isn't a source.
  let source = '';
  if (typeof d.s === 'string' && d.s.trim()) {
    const tag = d.s.trim().toLowerCase().replace(/[^a-z0-9._ -]/g, '').slice(0, 40);
    source = TAGS[tag] || (tag.includes('.') ? sourceName(tag) : tag.charAt(0).toUpperCase() + tag.slice(1));
  } else if (typeof d.r === 'string' && d.r) {
    try {
      const host = new URL(d.r).hostname.replace(/^www\./, '').toLowerCase();
      const own = new URL(req.url).hostname.replace(/^www\./, '').toLowerCase();
      if (host && host !== own && !host.endsWith('.netlify.app') && host !== 'localhost') source = sourceName(host).slice(0, 60);
    } catch { /* unreadable referrer: treat as direct */ }
  }

  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'Tablet'
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'Phone' : 'Computer';

  const geo = context?.geo || {};
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '';
  const store = getStore({ name: 'stats', consistency: 'strong' });
  let visitor;
  try {
    const salt = await getSalt(store);
    visitor = createHash('sha256').update(`${salt}|${day}|${ip}|${ua}`).digest('hex').slice(0, 16);
  } catch { return done(); }

  const event = {
    t: now,
    p: path,
    s: source,
    c: (geo.country && geo.country.code) || '',
    cn: (geo.country && geo.country.name) || '',
    ci: geo.city || '',
    d: device,
    v: visitor,
  };

  try {
    await store.setJSON(`e/${day}/${now}-${randomBytes(4).toString('hex')}`, event);
  } catch { /* never break the page over a stat */ }
  return done();
};
