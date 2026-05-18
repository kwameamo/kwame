import { getStore } from '@netlify/blobs';

export default async () => {
  try {
    const store = getStore({ name: 'blog', consistency: 'strong' });
    const posts = await store.get('posts', { type: 'json' });

    if (posts && posts.length > 0) {
      return new Response(JSON.stringify(posts), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    // Blob empty — fall back to the static JSON
    const seed = await fetch(`${process.env.URL}/blog-posts.json`);
    const fallback = seed.ok ? await seed.json() : [];

    return new Response(JSON.stringify(fallback), {
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
