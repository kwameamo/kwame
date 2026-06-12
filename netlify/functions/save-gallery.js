import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES    = 5 * 1024 * 1024; // 5MB ceiling after client-side downscale

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

  const { password, caption, link, image } = body;

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

    // Store the binary, with mime in blob metadata so the image route can echo it back.
    await store.set(`img:${nextId}`, buffer, { metadata: { mime } });

    const item = {
      id:        nextId,
      caption:   (caption || '').toString().slice(0, 140).trim(),
      link:      (link || '').toString().slice(0, 500).trim(),
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
