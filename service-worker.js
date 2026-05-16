const CACHE_NAME = 'kwame-v3';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/blog.html',
    '/work/fooseline-fest.html',
    '/work/chopright.html',
    '/work/kwaeemu-resort.html',
    '/work/akrofi-bene-foundation.html',
    '/work/akrofi-bene-web.html',
    '/css/base.css',
    '/css/index.css',
    '/css/blog.css',
    '/css/case-study.css',
    '/js/now-playing.js',
    '/js/index.js',
    '/js/blog.js',
    '/js/case-study.js',
    '/blog-posts.json',
    '/photos/kwame-scrib.png',
    '/photos/me.jpg',
    '/photos/pwa-icon.png',
    '/manifest.webmanifest',
    'https://raw.githubusercontent.com/kwameamo/kwame/main/brands/Asset%201.svg',
    'https://raw.githubusercontent.com/kwameamo/kwame/main/brands/Asset%205.svg',
    'https://raw.githubusercontent.com/kwameamo/kwame/main/brands/3.svg',
];

/* Pages that should always reflect the latest deployed version */
const HTML_PATHS = new Set([
    '/',
    '/index.html',
    '/blog.html',
    '/work/fooseline-fest.html',
    '/work/chopright.html',
    '/work/kwaeemu-resort.html',
    '/work/akrofi-bene-foundation.html',
    '/work/akrofi-bene-web.html',
]);

function isHTMLRequest(pathname) {
    return HTML_PATHS.has(pathname) || pathname.startsWith('/work/');
}

/* ── Install: precache static assets ── */
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

/* ── Activate: remove every old cache ── */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) { return caches.delete(key); })
            );
        })
    );
    self.clients.claim();
});

/* ── Message: page can trigger skipWaiting immediately ── */
self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/* ── Fetch ── */
self.addEventListener('fetch', function (event) {
    var url = new URL(event.request.url);

    /* Ignore non-GET, chrome-extension, and live API requests */
    if (event.request.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:') return;
    if (url.hostname === 'npc-api.aikins.xyz') return;
    if (url.hostname === 'open.er-api.com') return;

    /* ── Network-first for HTML pages ──────────────────────────
       Ensures Safari (and all browsers) always load the latest
       version of each page when online. Falls back to cache only
       when the network is unavailable (true offline mode).
    ─────────────────────────────────────────────────────────── */
    if (url.origin === self.location.origin && isHTMLRequest(url.pathname)) {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(function () {
                    return caches.match(event.request);
                })
        );
        return;
    }

    /* ── Network-first for blog-posts.json ── */
    if (url.pathname === '/blog-posts.json') {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(function () {
                    return caches.match(event.request);
                })
        );
        return;
    }

    /* ── Cache-first for CSS, JS, images, fonts ── */
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) return cached;
            return fetch(event.request).then(function (response) {
                if (!response || response.status === 206) return response;
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, clone);
                });
                return response;
            });
        })
    );
});
