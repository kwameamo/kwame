import { getStore } from '@netlify/blobs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { id, password } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return json({ error: 'Wrong password.' }, 401);
  }

  if (id == null) {
    return json({ error: 'Post ID required.' }, 400);
  }

  try {
    const store = getStore({ name: 'blog', consistency: 'strong' });
    const posts = await store.get('posts', { type: 'json' });

    if (!posts) {
      return json({ error: 'No posts found.' }, 404);
    }

    const filtered = posts.filter(p => p.id !== id);

    if (filtered.length === posts.length) {
      return json({ error: 'Post not found.' }, 404);
    }

    await store.setJSON('posts', filtered);
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
