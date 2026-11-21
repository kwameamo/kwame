import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

/*
  Receives one chunk of a B-Roll video (functions take at most 6MB a request,
  so the admin sends a shrunk video in 3MB pieces).
    { password, uid, part, data }   data: base64 of the chunk's bytes
  Chunks are stored as vid:<uid>:<part>. save-gallery then attaches the
  finished video to its photo entry, after checking every chunk arrived.
*/
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

const PART_BYTES = 3 * 1024 * 1024;
const MAX_PARTS = 40; // 120MB ceiling; a shrunk minute of video is far smaller

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

  const { uid, part, data } = body;
  if (!/^[a-f0-9]{16,40}$/.test(uid || '')) return json({ error: 'Bad upload id.' }, 400);
  if (!Number.isInteger(part) || part < 0 || part >= MAX_PARTS) return json({ error: 'Bad chunk number.' }, 400);
  if (typeof data !== 'string' || !data) return json({ error: 'Empty chunk.' }, 400);

  const buf = Buffer.from(data, 'base64');
  if (!buf.length || buf.length > PART_BYTES) return json({ error: 'Chunk too large.' }, 400);

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    await store.set(`vid:${uid}:${part}`, buf, { metadata: { size: buf.length } });
    return json({ ok: true, part, size: buf.length });
  } catch (err) {
    return json({ error: 'Could not store the chunk.' }, 500);
  }
};
