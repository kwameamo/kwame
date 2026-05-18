import { getStore } from '@netlify/blobs';

export const handler = async function () {
  try {
    const store = getStore({ name: 'blog', consistency: 'strong' });
    const posts = await store.get('posts', { type: 'json' });

    if (posts && posts.length > 0) {
      return respond(200, posts);
    }

    // Blob empty — fall back to the static JSON file
    const seed = await fetch(`${process.env.URL}/blog-posts.json`);
    const fallback = seed.ok ? await seed.json() : [];
    return respond(200, fallback);

  } catch (err) {
    return respond(500, { error: err.message });
  }
};

function respond(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}
