import { getStore } from '@netlify/blobs';
import { checkRateLimit, recordFailure, clearRateLimit } from './_ratelimit.js';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The list preview, like Notes: the first words of the body when no preview is given.
function previewFrom(html) {
  return String(html || '')
    .replace(/<\/(p|h2|h3|li)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

/*
  Create or edit a note (blog post).
  { password, verify: true }                     → password check only
  { password, title, date, content, ... }        → new note
  { password, id, title, date, content, ... }    → edit note #id
  Optional: excerpt (list preview), folder, pinned.
*/
export default async (req, context) => {
  const ip = context?.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';

  const { limited, retryAfter } = await checkRateLimit(ip);
  if (limited) {
    return json(
      { error: 'Too many failed attempts. Try again later.' },
      429,
      { 'Retry-After': String(retryAfter) }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { id, title, date, excerpt, content, folder, pinned, password, verify } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    await recordFailure(ip);
    return json({ error: 'Wrong password.' }, 401);
  }

  await clearRateLimit(ip);

  if (verify === true) {
    return json({ ok: true });
  }

  if (!title || !String(title).trim() || !content || !String(content).trim()) {
    return json({ error: 'A note needs a title and some text.' }, 400);
  }
  if (!DATE_RE.test(String(date || ''))) {
    return json({ error: 'Date must be YYYY-MM-DD.' }, 400);
  }

  const fields = {
    date: String(date),
    title: String(title).trim().slice(0, 200),
    excerpt: (excerpt && String(excerpt).trim()) ? String(excerpt).trim().slice(0, 300) : previewFrom(content),
    content: String(content),
    folder: (folder && String(folder).trim()) ? String(folder).trim().slice(0, 40) : 'Notes',
    pinned: pinned === true
  };

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

    let saved;
    if (id != null) {
      const at = posts.findIndex(p => p.id === id);
      if (at < 0) return json({ error: 'Note not found.' }, 404);
      saved = { ...posts[at], ...fields, id, updatedAt: new Date().toISOString() };
      posts[at] = saved;
    } else {
      const nextId = posts.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
      saved = { id: nextId, ...fields, createdAt: new Date().toISOString() };
      posts.push(saved);
    }

    await store.setJSON('posts', posts);

    return json({ ok: true, post: saved });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
