(function () {

    // Nav darkens on scroll
    window.addEventListener('scroll', function () {
        document.getElementById('site-nav').classList.toggle('dark', window.scrollY > 20);
    }, { passive: true });

    // Hamburger toggle
    var hamburger = document.getElementById('nav-hamburger');
    var mobileNav = document.getElementById('mobile-nav');

    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', function () {
            var isOpen = hamburger.classList.contains('open');
            hamburger.classList.toggle('open');
            mobileNav.classList.toggle('open');
            hamburger.setAttribute('aria-expanded', String(!isOpen));
            mobileNav.setAttribute('aria-hidden', String(isOpen));
        });

        // Close on any link click inside the mobile nav
        mobileNav.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                hamburger.classList.remove('open');
                mobileNav.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
                mobileNav.setAttribute('aria-hidden', 'true');
            });
        });

        // Close on outside tap
        document.addEventListener('click', function (e) {
            if (mobileNav.classList.contains('open') &&
                !mobileNav.contains(e.target) &&
                !hamburger.contains(e.target)) {
                hamburger.classList.remove('open');
                mobileNav.classList.remove('open');
            }
        });
    }

    // Inquiry form — show success state on submit
    var form = document.getElementById('inquire-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            form.style.display = 'none';
            document.getElementById('f-success').classList.add('show');
        });
    }

    // Hide mobile CTA bar when the inquire section is in view
    var inquireSection = document.getElementById('inquire');
    var mobileCta = document.getElementById('mobile-cta');

    if (inquireSection && mobileCta && 'IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entries) {
            mobileCta.classList.toggle('hidden', entries[0].isIntersecting);
        }, { threshold: 0.05 });
        obs.observe(inquireSection);
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }

}());
