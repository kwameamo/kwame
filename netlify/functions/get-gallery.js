import { getStore } from '@netlify/blobs';

/*
  Public read — the B-Roll photo list.
  Each item: { id, caption, place, takenAt, link, w, h, thumb, video?, mime, createdAt }
  A video item's image is its poster; video = { uid, parts, size, dur, trim? } plays from get-gallery-video?uid=.
  Image bytes come from get-gallery-image.
  The edge keeps the list for 30s and serves a stale copy while it refreshes,
  so the roll opens at once; the admin adds ?fresh=<time> to skip that.
*/
export default async (req) => {
  const fresh = new URL(req.url).searchParams.has('fresh');
  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    const items = await store.get('items', { type: 'json' });

    return new Response(JSON.stringify(Array.isArray(items) ? items : []), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': fresh ? 'no-store' : 'public, max-age=30, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
};
