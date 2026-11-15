import { getStore } from '@netlify/blobs';

/*
  Serves one B-Roll photo from Netlify Blobs.
    ?id=3                      the full photo (about 1600px)
    ?id=3&size=thumb&v=1       the grid tile (about 400px), v = tile version
  Bytes for an id (and tile version) never change, so the browser and
  Netlify's CDN both keep them for a year: after the first view a photo
  comes straight from the edge without running this function.
*/
const FOREVER     = 'public, max-age=31536000, immutable';
const FOREVER_CDN = 'public, durable, max-age=31536000, immutable';

export default async (req) => {
  const url  = new URL(req.url);
  const id   = url.searchParams.get('id');
  const size = url.searchParams.get('size');

  if (!id || !/^\d+$/.test(id)) {
    return new Response('Missing id', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    let blob = null;
    let isThumb = false;
    if (size === 'thumb') {
      blob = await store.getWithMetadata(`thumb:${id}`, { type: 'arrayBuffer' });
      isThumb = !!(blob && blob.data);
    }
    if (!blob || !blob.data) blob = await store.getWithMetadata(`img:${id}`, { type: 'arrayBuffer' });

    if (!blob || !blob.data) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const mime = (blob.metadata && blob.metadata.mime) || 'image/jpeg';
    // A tile request that fell back to the full photo is only kept briefly,
    // so the real tile takes over as soon as it exists.
    const fallback = size === 'thumb' && !isThumb;

    return new Response(blob.data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': fallback ? 'public, max-age=300' : FOREVER,
        'Netlify-CDN-Cache-Control': fallback ? 'public, max-age=300' : FOREVER_CDN
      }
    });
  } catch (err) {
    return new Response(err.message, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
};
