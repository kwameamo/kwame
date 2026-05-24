import { getStore } from '@netlify/blobs';

const WINDOW_MS   = 15 * 60 * 1000; // 15-minute window
const MAX_ATTEMPTS = 5;

const store = () => getStore({ name: 'ratelimit', consistency: 'strong' });

export async function checkRateLimit(ip) {
  const key  = `ip:${ip}`;
  const data = await store().get(key, { type: 'json' }) ?? { count: 0, resetAt: Date.now() + WINDOW_MS };
  const now  = Date.now();

  if (now > data.resetAt) {
    return { limited: false };
  }

  if (data.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

export async function recordFailure(ip) {
  const key  = `ip:${ip}`;
  const now  = Date.now();
  const data = await store().get(key, { type: 'json' }) ?? { count: 0, resetAt: now + WINDOW_MS };

  if (now > data.resetAt) {
    data.count  = 1;
    data.resetAt = now + WINDOW_MS;
  } else {
    data.count += 1;
  }

  await store().setJSON(key, data);
}

export async function clearRateLimit(ip) {
  await store().delete(`ip:${ip}`);
}
