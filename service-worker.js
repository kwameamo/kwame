/*
  kwame.vision — Service Worker
  Strategy: network-first for everything.
  Cache is purely an offline fallback — never served when the network is available.
  This guarantees users always see the latest deployment without a hard reload.
*/

const CACHE_NAME = 'kwame-v4';

/* ── Install ── skip waiting immediately, no precache */
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

/* ── Activate ── delete every old cache, claim all clients */
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

/* ── Message ── page can trigger skipWaiting directly */
self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/* ── Fetch ── network-first, cache on success, fallback offline */
self.addEventListener('fetch', function (event) {
    var req = event.request;
    var url = new URL(req.url);

    /* Pass through: non-GET, extensions, live APIs, form endpoints */
    if (req.method !== 'GET')                    return;
    if (url.protocol === 'chrome-extension:')    return;
    if (url.hostname === 'npc-api.aikins.xyz')   return;
    if (url.hostname === 'open.er-api.com')      return;
    if (url.hostname === 'formsubmit.co')        return;
    if (url.hostname === 'formsubmit.cloud')     return;
    if (url.hostname === 'api.web3forms.com')    return;
    if (url.hostname === 'fonts.googleapis.com') return;
    if (url.hostname === 'fonts.gstatic.com')    return;

    event.respondWith(
        fetch(req)
            .then(function (response) {
                /* Cache every successful response for offline use */
                if (response && (response.ok || response.type === 'opaque')) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(req, clone).catch(function () {});
                    });
                }
                return response;
            })
            .catch(function () {
                /* Offline: serve whatever we last cached */
                return caches.match(req);
            })
    );
});
