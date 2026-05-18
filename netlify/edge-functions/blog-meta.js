import { getStore } from '@netlify/blobs';

const SITE = 'https://kwame.vision';
const IMAGE = `${SITE}/photos/me.PNG`;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async (request, context) => {
  const url = new URL(request.url);
  const postIdStr = url.searchParams.get('post');
  if (!postIdStr) return context.next();

  const postId = parseInt(postIdStr, 10);
  if (isNaN(postId)) return context.next();

  let post;
  try {
    const store = getStore({ name: 'blog', consistency: 'strong' });
    let posts = await store.get('posts', { type: 'json' });

    if (!posts) {
      const seed = await fetch(`${SITE}/blog-posts.json`);
      posts = seed.ok ? await seed.json() : [];
    }

    post = posts.find(p => p.id === postId);
  } catch {
    return context.next();
  }

  if (!post) return context.next();

  const response = await context.next();
  const html = await response.text();

  const title  = esc(`${post.title} — David Kwame Amo`);
  const desc   = esc(post.excerpt.slice(0, 200));
  const postUrl = `${SITE}/blog.html?post=${postId}`;

  const tags = `
  <title>${title}</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${esc(postUrl)}">
  <meta property="og:image" content="${IMAGE}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${IMAGE}">`;

  // Inject at the top of <head> so these take precedence over static tags
  const modified = html.replace(/(<head[^>]*>)/, `$1${tags}`);

  return new Response(modified, {
    status: response.status,
    headers: response.headers
  });
};
