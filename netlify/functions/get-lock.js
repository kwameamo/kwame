import { getStore } from '@netlify/blobs';

/*
  The admin lock screen's wallpaper.
    ?part=config        { v, depth, clock } or {} when the built-in wallpaper is in use
    ?part=bg&v=…        the photo, cropped to the phone's shape (JPEG)
    ?part=subject&v=…   the person cut out of it, same size, transparent elsewhere (WebP)
  Public on purpose: the lock screen shows it before anyone has signed in.
  Images for a version never change, so they are cached for a year.
*/
const FOREVER = 'public, max-age=31536000, immutable';

export default async (req) => {
  const part = new URL(req.url).searchParams.get('part');
  const store = getStore({ name: 'lock', consistency: 'strong' });
  try {
    if (part === 'config') {
      const cfg = (await store.get('config', { type: 'json' })) || {};
      return new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (part === 'bg' || part === 'subject') {
      const blob = await store.getWithMetadata(part, { type: 'arrayBuffer' });
      if (!blob || !blob.data) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
      return new Response(blob.data, {
        headers: { 'Content-Type': (blob.metadata && blob.metadata.mime) || 'image/jpeg', 'Cache-Control': FOREVER, 'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable' },
      });
    }
    return new Response('Unknown part', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('Server error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
};
