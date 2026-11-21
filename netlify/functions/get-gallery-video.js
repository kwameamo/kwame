import { getStore } from '@netlify/blobs';

/*
  Streams one B-Roll video: ?uid=<upload id>
  Answers byte ranges (Safari won't play a video without them). The video is
  stored in 3MB chunks, so each answer covers at most the rest of one chunk;
  players simply ask again for the next range.
*/
const PART_BYTES = 3 * 1024 * 1024;

const headersFor = (extra) => ({
  'Content-Type': 'video/mp4',
  'Accept-Ranges': 'bytes',
  // The bytes for an upload id never change.
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Netlify-CDN-Cache-Control': 'no-store',
  ...extra,
});

export default async (req) => {
  const uid = new URL(req.url).searchParams.get('uid') || '';
  if (!/^[a-f0-9]{16,40}$/.test(uid)) return new Response('Bad id', { status: 400, headers: { 'Cache-Control': 'no-store' } });

  try {
    const store = getStore({ name: 'gallery', consistency: 'strong' });
    const meta = await store.get(`vmeta:${uid}`, { type: 'json' });
    if (!meta || !meta.size) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const size = meta.size;

    let start = 0, end = size - 1;
    const range = req.headers.get('range');
    if (range) {
      const m = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!m || (m[1] === '' && m[2] === '')) {
        return new Response(null, { status: 416, headers: headersFor({ 'Content-Range': `bytes */${size}` }) });
      }
      if (m[1] === '') { start = Math.max(0, size - parseInt(m[2], 10)); }        // last N bytes
      else { start = parseInt(m[1], 10); if (m[2] !== '') end = Math.min(size - 1, parseInt(m[2], 10)); }
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: headersFor({ 'Content-Range': `bytes */${size}` }) });
      }
    }

    // Never cross a chunk boundary in one answer.
    const part = Math.floor(start / PART_BYTES);
    end = Math.min(end, (part + 1) * PART_BYTES - 1);
    const chunk = await store.get(`vid:${uid}:${part}`, { type: 'arrayBuffer' });
    if (!chunk) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const from = start - part * PART_BYTES;
    const body = new Uint8Array(chunk).subarray(from, from + (end - start + 1));

    return new Response(body, {
      status: 206,
      headers: headersFor({ 'Content-Range': `bytes ${start}-${start + body.length - 1}/${size}`, 'Content-Length': String(body.length) }),
    });
  } catch {
    return new Response('Server error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
};
