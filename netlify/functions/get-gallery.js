import { getStore } from '@netlify/blobs';

/*
  Public read — returns the gallery metadata array.
  Each item: { id, caption, link, mime, createdAt }
  The actual image bytes are served by get-gallery-image.
*/
export default async () => {
  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    const items = await store.get('items', { type: 'json' });

    return new Response(JSON.stringify(Array.isArray(items) ? items : []), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
