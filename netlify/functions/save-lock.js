import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

/*
  Sets the admin lock screen's wallpaper.
    { password, bg, subject?, depth, clock, top }   bg: JPEG data URL, subject: WebP/PNG data URL
    { password, keep: true, depth, clock }          same photo, new settings
    { password, reset: true }                  back to the built-in wallpaper
*/
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

const MAX_BYTES = 4 * 1024 * 1024; // a PNG cutout (browsers without WebP encoding) can run past 3MB

function decode(dataUrl, allowed) {
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m || !allowed.includes(m[1].toLowerCase())) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length && buf.length <= MAX_BYTES ? { mime: m[1].toLowerCase(), buf } : null;
}

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

  const store = getStore({ name: 'lock', consistency: 'strong' });
  try {
    if (body.reset) {
      await Promise.all(['config', 'bg', 'subject'].map((k) => store.delete(k)));
      return json({ ok: true, config: {} });
    }

    const hex = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : fallback);

    // Same photo, new clock colour or depth: only the settings change.
    if (body.keep) {
      const existing = await store.get('config', { type: 'json' });
      if (!existing || !existing.v) return json({ error: 'There is no photo to keep. Choose one first.' }, 400);
      const config = { ...existing, clock: hex(body.clock, existing.clock), depth: !!(existing.cut && body.depth) };
      await store.setJSON('config', config);
      return json({ ok: true, config });
    }

    const bg = decode(body.bg, ['image/jpeg', 'image/webp']);
    if (!bg) return json({ error: 'The photo is missing or too large (max 4MB).' }, 400);
    const subject = body.subject ? decode(body.subject, ['image/webp', 'image/png']) : null;
    if (body.subject && !subject) return json({ error: 'The cutout is too large (max 4MB).' }, 400);

    const config = {
      v: Date.now(),
      cut: !!subject,
      depth: !!(subject && body.depth),
      clock: hex(body.clock, '#ffffff'),
      top: hex(body.top, '#000000'),
    };

    await store.set('bg', bg.buf, { metadata: { mime: bg.mime } });
    if (subject) await store.set('subject', subject.buf, { metadata: { mime: subject.mime } });
    else await store.delete('subject');
    await store.setJSON('config', config);
    return json({ ok: true, config });
  } catch {
    return json({ error: 'Could not save the wallpaper.' }, 500);
  }
};
