(function () {
    var nav = document.getElementById('cs-nav');

    window.addEventListener('scroll', function () {
        if (nav) nav.classList.toggle('dark', window.scrollY > 10);
    }, { passive: true });

    var fy = document.getElementById('footer-year');
    if (fy) fy.textContent = new Date().getFullYear();

    /* SW registration is handled by sw-updater.js */
}());
