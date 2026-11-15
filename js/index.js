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
       CONTACT FORM
       Checks the required fields, fills the single
       "name" field web3forms expects, then sends in
       place and shows the result. Without JavaScript
       the form still posts normally.
    ───────────────────────────────────────── */
    var inquireForm = document.getElementById('inquire-form');
    if (inquireForm) {
        var invalidEl = document.getElementById('f-invalid');
        var sendBtn   = document.getElementById('f-submit-btn');
        var okEl      = document.getElementById('f-success');
        var errEl     = document.getElementById('f-error');

        function mark(el, bad) {
            var box = el.closest('.ct-field') || el.closest('.ct-choices');
            if (box) box.classList.toggle('is-invalid', bad);
        }

        function check() {
            var problems = [];
            var first = inquireForm.querySelector('[name="first_name"]');
            var last  = inquireForm.querySelector('[name="last_name"]');
            var email = inquireForm.querySelector('[name="email"]');
            var msg   = inquireForm.querySelector('[name="message"]');
            var type  = inquireForm.querySelector('[name="project_type"]:checked');
            [first, last].forEach(function (f) { mark(f, !f.value.trim()); });
            if (!first.value.trim() || !last.value.trim()) problems.push('your name');
            var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
            mark(email, !emailOk);
            if (!emailOk) problems.push('a valid email');
            mark(inquireForm.querySelector('[name="project_type"]'), !type);
            if (!type) problems.push('what you need');
            mark(msg, !msg.value.trim());
            if (!msg.value.trim()) problems.push('a few project details');
            return problems;
        }

        inquireForm.addEventListener('input', function (e) { mark(e.target, false); invalidEl.hidden = true; });
        inquireForm.addEventListener('change', function (e) { mark(e.target, false); invalidEl.hidden = true; });

        inquireForm.addEventListener('submit', function (e) {
            var nameField = document.getElementById('f-name');
            nameField.value = [inquireForm.first_name.value.trim(), inquireForm.last_name.value.trim()].filter(Boolean).join(' ');

            var problems = check();
            if (problems.length) {
                e.preventDefault();
                var list = problems.length > 1 ? problems.slice(0, -1).join(', ') + ' and ' + problems[problems.length - 1] : problems[0];
                invalidEl.textContent = 'Please add ' + list + '.';
                invalidEl.hidden = false;
                var firstBad = inquireForm.querySelector('.is-invalid input, .is-invalid textarea');
                if (firstBad) firstBad.focus();
                return;
            }
            if (!window.fetch || !window.FormData) return; // let the browser post it

            e.preventDefault();
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending…';
            fetch(inquireForm.action, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: new FormData(inquireForm)
            }).then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    if (!res.ok || data.success === false) throw new Error(data.message || 'failed');
                });
            }).then(function () {
                inquireForm.hidden = true;
                okEl.hidden = false;
                errEl.hidden = true;
                okEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }).catch(function () {
                errEl.hidden = false;
                sendBtn.disabled = false;
                sendBtn.textContent = 'Try Again';
            });
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
       ABOUT — tiles rise into view once, a beat apart
    ───────────────────────────────────────── */
    var reveals = document.querySelectorAll('.ab-reveal');
    if (reveals.length) {
        if (!('IntersectionObserver' in window) ||
            (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
            Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
        } else {
            var revealIO = new IntersectionObserver(function (entries) {
                var delay = 0;
                entries.forEach(function (entry) {
                    // Also catch tiles scrolled past too fast to be seen intersecting
                    if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) return;
                    var el = entry.target;
                    el.style.transitionDelay = delay + 'ms';
                    delay += 70;
                    el.classList.add('is-in');
                    setTimeout(function () { el.style.transitionDelay = ''; }, 1000 + delay);
                    revealIO.unobserve(el);
                });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
            Array.prototype.forEach.call(reveals, function (el) { revealIO.observe(el); });
        }
    }


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
