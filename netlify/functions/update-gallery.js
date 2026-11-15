import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });

const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;
const THUMB_MAX  = 400 * 1024;
const THUMB_MIME = ['image/jpeg', 'image/webp'];

/*
  Edit one B-Roll photo.
  { password, id, caption?, place?, takenAt?, link?, thumb?, w?, h? }
  Only the fields sent are changed. `thumb` is a small data URL built in
  the admin from the full photo, used for fast grid tiles.
*/
export default async (req, context) => {
  const ip = context?.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';

  const { limited, retryAfter } = await checkRateLimit(ip);
  if (limited) {
    return json({ error: 'Too many failed attempts. Try again later.' }, 429, { 'Retry-After': String(retryAfter) });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { password, id } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    await recordFailure(ip);
    return json({ error: 'Wrong password.' }, 401);
  }

  await clearRateLimit(ip);

  if (id == null) return json({ error: 'Photo ID required.' }, 400);

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    let items = await store.get('items', { type: 'json' });
    if (!Array.isArray(items)) items = [];

    const at = items.findIndex(it => it.id === id);
    if (at < 0) return json({ error: 'Photo not found.' }, 404);
    const item = { ...items[at] };

    if ('caption' in body) item.caption = String(body.caption || '').slice(0, 140).trim();
    if ('place' in body)   item.place   = String(body.place || '').slice(0, 80).trim();
    if ('link' in body)    item.link    = String(body.link || '').slice(0, 500).trim();
    if ('takenAt' in body) {
      if (body.takenAt && !DATE_RE.test(String(body.takenAt))) return json({ error: 'Date must be YYYY-MM-DD.' }, 400);
      if (body.takenAt) item.takenAt = String(body.takenAt);
      else delete item.takenAt;
    }

    if (body.thumb) {
      const m = String(body.thumb).match(/^data:([^;]+);base64,(.+)$/);
      if (!m || !THUMB_MIME.includes(m[1].toLowerCase())) return json({ error: 'Thumbnail must be a JPEG or WebP data URL.' }, 400);
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > THUMB_MAX) return json({ error: 'Thumbnail is too large.' }, 400);
      await store.set(`thumb:${id}`, buf, { metadata: { mime: m[1].toLowerCase() } });
      // The version goes into the tile URL, so a cached older tile is never reused.
      item.thumb = (+item.thumb || 0) + 1;
    }
    if (Number.isFinite(+body.w) && +body.w > 0 && +body.w <= 20000) item.w = Math.round(+body.w);
    if (Number.isFinite(+body.h) && +body.h > 0 && +body.h <= 20000) item.h = Math.round(+body.h);

    items[at] = item;
    await store.setJSON('items', items);

    return json({ ok: true, item });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
