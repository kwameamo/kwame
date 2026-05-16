(function () {
    // Nav darkens on scroll
    window.addEventListener('scroll', function () {
        document.getElementById('site-nav').classList.toggle('dark', window.scrollY > 20);
    }, { passive: true });

    // Inquiry form — show success state on submit
    var form = document.getElementById('inquire-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            form.style.display = 'none';
            document.getElementById('f-success').classList.add('show');
        });
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
}());
