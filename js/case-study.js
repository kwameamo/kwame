(function () {
    var nav = document.getElementById('cs-nav');

    window.addEventListener('scroll', function () {
        if (nav) nav.classList.toggle('dark', window.scrollY > 10);
    }, { passive: true });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
            reg.addEventListener('updatefound', function () {
                var next = reg.installing;
                if (!next) return;
                next.addEventListener('statechange', function () {
                    if (next.state === 'installed' && navigator.serviceWorker.controller) {
                        next.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        });

        var reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (reloading) return;
            reloading = true;
            window.location.reload();
        });
    }
}());
