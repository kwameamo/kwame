import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });

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

  const { id, password } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    await recordFailure(ip);
    return json({ error: 'Wrong password.' }, 401);
  }

  await clearRateLimit(ip);

  if (id == null) {
    return json({ error: 'Image ID required.' }, 400);
  }

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    let items = await store.get('items', { type: 'json' });
    if (!Array.isArray(items)) items = [];

    const filtered = items.filter(it => it.id !== id);
    if (filtered.length === items.length) {
      return json({ error: 'Image not found.' }, 404);
    }

    await store.setJSON('items', filtered);
    // Remove the binary too. Ignore if it's already gone.
    try { await store.delete(`img:${id}`); } catch {}

    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
