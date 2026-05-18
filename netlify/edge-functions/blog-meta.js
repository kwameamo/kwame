const SITE  = 'https://kwame.vision';
const IMAGE = `${SITE}/photos/me.jpg`;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async (request, context) => {
  const url       = new URL(request.url);
  const postIdStr = url.searchParams.get('post');
  if (!postIdStr) return context.next();

  const postId = parseInt(postIdStr, 10);
  if (isNaN(postId)) return context.next();

  // Fetch posts via the existing get-posts function — no Blobs import needed
  let post;
  try {
    const apiUrl   = new URL('/.netlify/functions/get-posts', request.url);
    const postsRes = await fetch(apiUrl.toString());
    if (!postsRes.ok) return context.next();
    const posts = await postsRes.json();
    post = Array.isArray(posts) ? posts.find(p => p.id === postId) : null;
  } catch {
    return context.next();
  }

  if (!post) return context.next();

  const response = await context.next();
  const html     = await response.text();

  const title   = esc(`${post.title} — David Kwame Amo`);
  const desc    = esc(post.excerpt.slice(0, 200));
  const postUrl = esc(`${SITE}/blog.html?post=${postId}`);

  const tags = [
    `<title>${title}</title>`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${postUrl}">`,
    `<meta property="og:image" content="${IMAGE}">`,
    `<meta property="og:type" content="article">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
    `<meta name="twitter:image" content="${IMAGE}">`,
  ].join('\n  ');

  // Use a function callback — avoids $ being interpreted as a replacement pattern
  const modified = html.replace(/(<head[^>]*>)/i, (m) => `${m}\n  ${tags}`);

  // Content-Length is now wrong — remove it so the browser doesn't truncate
  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(modified, { status: response.status, headers });
};
