import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES    = 5 * 1024 * 1024; // 5MB ceiling after client-side downscale

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dim(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? n : undefined;
}

export default async (req, context) => {
  const ip = context?.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';

  const { limited, retryAfter } = await checkRateLimit(ip);
  if (limited) {
    return json(
      { error: 'Too many failed attempts. Try again later.' },
      429,
      { 'Retry-After': String(retryAfter) }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { password, caption, link, image, place, takenAt, takenStamp, w, h, thumb, video } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    await recordFailure(ip);
    return json({ error: 'Wrong password.' }, 401);
  }

  await clearRateLimit(ip);

  if (!image || typeof image !== 'string') {
    return json({ error: 'An image is required.' }, 400);
  }

  // Parse data URL: data:image/jpeg;base64,XXXX
  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return json({ error: 'Image must be a base64 data URL.' }, 400);
  }

  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return json({ error: 'Unsupported image type.' }, 400);
  }

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return json({ error: 'Could not decode image.' }, 400);
  }

  if (buffer.length > MAX_BYTES) {
    return json({ error: 'Image is too large (max 5MB).' }, 400);
  }

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    let items = await store.get('items', { type: 'json' });
    if (!Array.isArray(items)) items = [];

    const nextId = items.reduce((m, it) => Math.max(m, it.id || 0), 0) + 1;

    // A video: the image above is its poster, and its chunks were uploaded first
    // through save-gallery-video. Check they all arrived before listing it.
    let videoInfo;
    if (video && typeof video === 'object') {
      const uid = String(video.uid || '');
      const parts = parseInt(video.parts, 10), size = parseInt(video.size, 10);
      if (!/^[a-f0-9]{16,40}$/.test(uid) || !(parts > 0 && parts <= 40) || !(size > 0)) {
        return json({ error: 'Video details are incomplete.' }, 400);
      }
      let total = 0;
      for (let i = 0; i < parts; i++) {
        const m = await store.getMetadata(`vid:${uid}:${i}`);
        if (!m) return json({ error: `Video chunk ${i + 1} of ${parts} is missing. Try again.` }, 400);
        total += (m.metadata && m.metadata.size) || 0;
      }
      if (total !== size) return json({ error: 'The video upload is incomplete. Try again.' }, 400);
      await store.setJSON(`vmeta:${uid}`, { size, parts });
      const dur = Number(video.dur);
      videoInfo = { uid, parts, size, dur: Number.isFinite(dur) && dur > 0 ? Math.round(dur * 10) / 10 : undefined };
    }

    // Store the binary, with mime in blob metadata so the image route can echo it back.
    await store.set(`img:${nextId}`, buffer, { metadata: { mime } });

    // A small tile (about 400px) for the grid, built in the admin before upload.
    let hasThumb = 0;
    const tm = typeof thumb === 'string' ? thumb.match(/^data:(image\/(?:jpeg|webp));base64,(.+)$/) : null;
    if (tm) {
      const tbuf = Buffer.from(tm[2], 'base64');
      if (tbuf.length <= 400 * 1024) {
        await store.set(`thumb:${nextId}`, tbuf, { metadata: { mime: tm[1] } });
        hasThumb = 1;
      }
    }

    const item = {
      id:        nextId,
      caption:   (caption || '').toString().slice(0, 140).trim(),
      link:      (link || '').toString().slice(0, 500).trim(),
      // B-Roll metadata: where it was taken, the day it was taken (not uploaded), pixel size.
      place:     (place || '').toString().slice(0, 80).trim(),
      takenAt:   DATE_RE.test(String(takenAt || '')) ? String(takenAt) : undefined,
      // When it was shot, to the second, from the photo's metadata: orders the roll
      takenStamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(String(takenStamp || '')) ? String(takenStamp) : undefined,
      w:         dim(w),
      h:         dim(h),
      thumb:     hasThumb || undefined,
      video:     videoInfo,
      mime,
      createdAt: new Date().toISOString()
    };
    // Newest first.
    items.unshift(item);

    await store.setJSON('items', items);

    return json({ ok: true, item });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
