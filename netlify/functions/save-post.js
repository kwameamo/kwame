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

  const { title, date, excerpt, content, password, verify } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return json({ error: 'Wrong password.' }, 401);
  }

  if (verify === true) {
    return json({ ok: true });
  }

  if (!title || !date || !excerpt || !content) {
    return json({ error: 'All fields are required.' }, 400);
  }

  try {
    const store = getStore({ name: 'blog', consistency: 'strong' });
    let posts = await store.get('posts', { type: 'json' });

    if (!posts) {
      try {
        const seed = await fetch(`${process.env.URL}/blog-posts.json`);
        posts = seed.ok ? await seed.json() : [];
      } catch {
        posts = [];
      }
    }

    const nextId = posts.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
    posts.push({ id: nextId, date, title, excerpt, content });

    await store.setJSON('posts', posts);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
