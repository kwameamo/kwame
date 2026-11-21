/* Page view counter for the admin's Stats tab.
   No cookies, nothing stored on the visitor's device. Skipped on any
   device where the admin has been unlocked (it sets kv-me), so Kwame's
   own visits don't count, and for browsers that send Do Not Track or
   Global Privacy Control. */
(function () {
    try { if (localStorage.getItem('kv-me')) return; } catch (_) {}
    if (navigator.webdriver) return;
    if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;   // the visitor asked not to be counted

    function send() {
        var q = new URLSearchParams(location.search);
        var body = JSON.stringify({
            p: location.pathname,
            r: document.referrer || '',
            s: q.get('utm_source') || q.get('ref') || ''
        });
        var url = '/.netlify/functions/track';
        // text/plain keeps it a simple request: no preflight, survives page exit.
        if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
        fetch(url, { method: 'POST', body: body, keepalive: true }).catch(function () {});
    }

    // Count a prerendered page only once it is actually shown.
    if (document.visibilityState === 'prerender') {
        document.addEventListener('visibilitychange', function once() {
            if (document.visibilityState === 'prerender') return;
            document.removeEventListener('visibilitychange', once);
            send();
        });
    } else send();
})();
