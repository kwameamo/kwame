(function () {
    var nav = document.getElementById('cs-nav');

    window.addEventListener('scroll', function () {
        if (nav) nav.classList.toggle('dark', window.scrollY > 10);
    }, { passive: true });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
}());
