exports.handler = async function (event) {
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

  const token = process.env.BLOG_GITHUB_TOKEN;

  // Debug: surface token state without exposing value
  if (!token) {
    return respond(500, { error: 'BLOG_GITHUB_TOKEN is not set in environment variables.' });
  }

  const tokenType = token.startsWith('github_pat_') ? 'fine-grained'
                  : token.startsWith('ghp_')        ? 'classic'
                  : 'unknown format';

  const repo   = 'kwameamo/kwame';
  const branch = 'main';
  const path   = 'blog-posts.json';
  const url    = `https://api.github.com/repos/${repo}/contents/${path}`;

  const ghHeaders = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kwame-blog-admin'
  };

  try {
    const getRes = await fetch(`${url}?ref=${branch}`, { headers: ghHeaders });
    if (!getRes.ok) {
      const e = await getRes.json();
      throw new Error(`GitHub read failed (${getRes.status}): ${e.message}`);
    }
    const file = await getRes.json();

    const posts = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    const nextId = posts.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
    posts.push({ id: nextId, date, title, excerpt, content });

    const encoded = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `blog: add "${title}"`,
        content: encoded,
        sha: file.sha,
        branch
      })
    });

    if (!putRes.ok) {
      const e = await putRes.json();
      throw new Error(
        `GitHub write failed (${putRes.status}, token: ${tokenType}): ${e.message}` +
        (e.documentation_url ? ` — ${e.documentation_url}` : '')
      );
    }

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
