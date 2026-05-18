import { getStore } from '@netlify/blobs';

export const handler = async function (event) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return respond(400, { error: 'Invalid request body.' });
  }

  const { title, date, excerpt, content, password, verify } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return respond(401, { error: 'Wrong password.' });
  }

  if (verify === true) {
    return respond(200, { ok: true });
  }

  if (!title || !date || !excerpt || !content) {
    return respond(400, { error: 'All fields are required.' });
  }

  try {
    const store = getStore({ name: 'blog', consistency: 'strong' });
    let posts = await store.get('posts', { type: 'json' });

    if (!posts) {
      // First save — seed from the static JSON already in the repo
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

    return respond(200, { ok: true });
  } catch (err) {
    return respond(500, { error: err.message });
  }
};

function respond(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
