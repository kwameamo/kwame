exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

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

  // Password-only check — used by the lock screen before showing the form
  if (verify === true) {
    return respond(200, { ok: true });
  }

  if (!title || !date || !excerpt || !content) {
    return respond(400, { error: 'All fields are required.' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = 'kwameamo/kwame';
  const branch = 'main';
  const path  = 'blog-posts.json';
  const url   = `https://api.github.com/repos/${repo}/contents/${path}`;

  const ghHeaders = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kwame-blog-admin'
  };

  try {
    // 1. Fetch current file + sha
    const getRes = await fetch(`${url}?ref=${branch}`, { headers: ghHeaders });
    if (!getRes.ok) {
      const e = await getRes.json();
      throw new Error(`GitHub read failed: ${e.message}`);
    }
    const file = await getRes.json();

    // 2. Decode → parse → append
    const posts = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
    const nextId = posts.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
    posts.push({ id: nextId, date, title, excerpt, content });

    // 3. Encode → commit
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
      throw new Error(`GitHub write failed: ${e.message}`);
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
