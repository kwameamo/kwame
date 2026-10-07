(function () {
    'use strict';

    /* ─────────────────────────────────────────
       HERO CLOCK + YEAR COUNTER
       Updates every second. START_YEAR drives
       the "years active" stat in the hero panel.
    ───────────────────────────────────────── */
    var yearEl       = document.getElementById('hero-year');
    var footerYearEl = document.getElementById('footer-year');
    var clockEl      = document.getElementById('hero-clock');

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
        var now = new Date();
        var yr  = now.getUTCFullYear();
        if (yearEl)       yearEl.textContent       = yr;
        if (footerYearEl) footerYearEl.textContent = yr;
        if (clockEl) clockEl.textContent = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds());
    }

    tick();
    setInterval(tick, 1000);


    /* ─────────────────────────────────────────
       NAV — darken border on scroll
    ───────────────────────────────────────── */
    window.addEventListener('scroll', function () {
        document.getElementById('site-nav').classList.toggle('dark', window.scrollY > 20);
    }, { passive: true });


    /* ─────────────────────────────────────────
       HAMBURGER MENU
    ───────────────────────────────────────── */
    var hamburger = document.getElementById('nav-hamburger');
    var mobileNav = document.getElementById('mobile-nav');

    function closeMobileNav() {
        if (!hamburger || !mobileNav) return;
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
    }

    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', function () {
            var isOpen = hamburger.classList.contains('open');
            hamburger.classList.toggle('open');
            mobileNav.classList.toggle('open');
            hamburger.setAttribute('aria-expanded', String(!isOpen));
            mobileNav.setAttribute('aria-hidden', String(isOpen));
        });

        mobileNav.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', closeMobileNav);
        });

        document.addEventListener('click', function (e) {
            if (mobileNav.classList.contains('open') &&
                !mobileNav.contains(e.target) &&
                !hamburger.contains(e.target)) {
                closeMobileNav();
            }
        });
    }


    /* ─────────────────────────────────────────
       INQUIRY FORM — combine first + last name
       formsubmit.cloud requires a field called
       "name"; we populate it from the two inputs
       before the native POST fires.
    ───────────────────────────────────────── */
    var inquireForm = document.getElementById('inquire-form');
    if (inquireForm) {
        inquireForm.addEventListener('submit', function () {
            var first     = inquireForm.querySelector('[name="first_name"]');
            var last      = inquireForm.querySelector('[name="last_name"]');
            var nameField = document.getElementById('f-name');
            if (first && last && nameField) {
                nameField.value = [first.value.trim(), last.value.trim()]
                    .filter(Boolean).join(' ');
            }
        });
    }


    /* ─────────────────────────────────────────
       COMING SOON CARDS — toast on click/Enter
    ───────────────────────────────────────── */
    var toastTimer = null;

    function showToast(msg) {
        var existing = document.getElementById('wi-toast');
        if (existing) {
            clearTimeout(toastTimer);
            existing.remove();
        }
        var t = document.createElement('div');
        t.id        = 'wi-toast';
        t.className = 'wi-toast';
        t.textContent = msg;
        t.setAttribute('aria-live', 'polite');
        document.body.appendChild(t);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { t.classList.add('show'); });
        });
        toastTimer = setTimeout(function () {
            t.classList.remove('show');
            setTimeout(function () { t.remove(); }, 240);
        }, 2600);
    }

    document.querySelectorAll('[data-coming-soon]').forEach(function (card) {
        card.addEventListener('click', function () {
            showToast('Still in progress — check back soon.');
        });
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showToast('Still in progress — check back soon.');
            }
        });
    });


    /* ─────────────────────────────────────────
       MOBILE CTA — hide when inquire is visible
    ───────────────────────────────────────── */
    var inquireSection = document.getElementById('inquire');
    var mobileCta = document.getElementById('mobile-cta');

    if (inquireSection && mobileCta && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            mobileCta.classList.toggle('hidden', entries[0].isIntersecting);
        }, { threshold: 0.05 }).observe(inquireSection);
    }



}()); /* SW registration is handled by sw-updater.js */
