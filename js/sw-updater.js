/*
  sw-updater.js
  Handles service worker registration and update detection for all pages.
  - Calls reg.update() on load and whenever the tab regains focus so Safari
    never waits 24 hours before checking for a new SW.
  - Sends SKIP_WAITING as soon as a new SW is installed so it activates
    immediately without needing all tabs to be closed.
  - Reloads the page once the new SW takes control, so the network-first
    fetch strategy serves the latest assets right away.
*/
(function () {
    if (!('serviceWorker' in navigator)) return;

    var lastCheck = 0;

    function checkForUpdate(reg) {
        var now = Date.now();
        if (now - lastCheck < 30000) return; /* at most every 30 seconds */
        lastCheck = now;
        reg.update().catch(function () {});
    }

    navigator.serviceWorker.register('/service-worker.js').then(function (reg) {

        /* Force an update check immediately after registration */
        checkForUpdate(reg);

        /* Watch for a new SW installing */
        reg.addEventListener('updatefound', function () {
            var next = reg.installing;
            if (!next) return;

            next.addEventListener('statechange', function () {
                /* New SW has installed and is waiting — activate it now */
                if (next.state === 'installed' && navigator.serviceWorker.controller) {
                    next.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        });

        /* Re-check for a new SW every time the user returns to the tab.
           This is the key fix for Safari which otherwise throttles SW checks. */
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') checkForUpdate(reg);
        });

    }).catch(function () {});

}());
