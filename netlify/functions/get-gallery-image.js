import { getStore } from '@netlify/blobs';

/*
  Serves a single gallery image's binary from Netlify Blobs.
  Usage: /.netlify/functions/get-gallery-image?id=3
  Each image is stored immutably under its id, so we can cache hard.
*/
export default async (req) => {
  const url = new URL(req.url);
  const id  = url.searchParams.get('id');

  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    const blob  = await store.getWithMetadata(`img:${id}`, { type: 'arrayBuffer' });

    if (!blob || !blob.data) {
      return new Response('Not found', { status: 404 });
    }

    const mime = (blob.metadata && blob.metadata.mime) || 'image/jpeg';

    return new Response(blob.data, {
      headers: {
        'Content-Type': mime,
        // Image bytes never change for a given id — cache aggressively.
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
};
