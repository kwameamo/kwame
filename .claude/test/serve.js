/* Tiny static server + mocked gallery endpoints for local testing. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8731;

// 1x1 px PNGs in different colors, scaled by the browser — fine for behavior tests.
function pngPixel(r, g, b) {
  // Pre-built 1x1 PNG with tRNS-less RGB. Easiest: use a tiny PNG encoder inline.
  const zlib = require('zlib');
  const crc32 = (buf) => {
    let c, crcTable = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.from([0, r, g, b]); // filter byte + pixel
  const idat = require('zlib').deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
}

const COLORS = [[200,80,80],[80,160,90],[70,90,200],[210,170,60],[150,80,180]];
const ITEMS = [
  { id: 1, caption: 'Studio shoot · Accra with a very long caption that should be fully visible to the reader', mime: 'image/png', createdAt: '2026-06-01T00:00:00Z' },
  { id: 2, caption: 'Garment drop 02', mime: 'image/png', createdAt: '2026-06-02T00:00:00Z' },
  { id: 3, caption: '', mime: 'image/png', createdAt: '2026-06-03T00:00:00Z' },
  { id: 4, caption: 'Behind the scenes', mime: 'image/png', createdAt: '2026-06-04T00:00:00Z' },
  { id: 5, caption: 'Kejetia merch', mime: 'image/png', createdAt: '2026-06-05T00:00:00Z' },
];

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  // Mocked functions
  if (url.pathname === '/.netlify/functions/get-gallery') {
    const empty = url.searchParams.get('empty');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ITEMS));
    return;
  }
  if (url.pathname === '/.netlify/functions/get-gallery-image') {
    const id = parseInt(url.searchParams.get('id'), 10) || 1;
    const c = COLORS[(id - 1) % COLORS.length];
    // Realistic 4:5 sized image so layout/lightbox sizing is testable.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">` +
      `<rect width="800" height="1000" fill="rgb(${c[0]},${c[1]},${c[2]})"/>` +
      `<text x="400" y="520" font-size="120" fill="#fff" text-anchor="middle">${id}</text></svg>`;
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end(svg);
    return;
  }
  if (url.pathname.startsWith('/.netlify/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  // Static
  let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, p, 'index.html');
    if (fs.existsSync(alt)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(alt));
      return;
    }
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(PORT, () => console.log('serving on http://localhost:' + PORT));
