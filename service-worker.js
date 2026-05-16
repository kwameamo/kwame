const CACHE_NAME = 'kwame-v1';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/blog.html',
    '/work/gye-owuo-corp.html',
    '/work/cherie-by-a.html',
    '/work/curiolabs.html',
    '/work/foldsvtg.html',
    '/work/vision97.html',
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
    '/icons/icon.svg',
    '/manifest.webmanifest',
    'https://raw.githubusercontent.com/kwameamo/kwame/main/brands/Asset%201.svg',
    'https://raw.githubusercontent.com/kwameamo/kwame/main/brands/Asset%205.svg',
    'https://raw.githubusercontent.com/kwameamo/kwame/main/brands/3.svg',
];

// Install — precache all static assets
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// Activate — remove old caches
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

// Fetch — strategy varies by request type
self.addEventListener('fetch', function (event) {
    var url = event.request.url;

    // Skip non-GET and browser extension requests
    if (event.request.method !== 'GET') return;
    if (url.startsWith('chrome-extension://')) return;

    // Skip now-playing API and WebSocket — always live
    if (url.includes('npc-api.aikins.xyz')) return;

    // Network-first for blog-posts.json — keep content fresh
    if (url.includes('blog-posts.json')) {
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

    // Cache-first for everything else (HTML, CSS, JS, images, fonts)
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) return cached;
            return fetch(event.request).then(function (response) {
                // Only cache valid same-origin or opaque responses
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
