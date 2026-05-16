(function () {
    'use strict';

    /* ─────────────────────────────────────────
       HERO CLOCK + YEAR COUNTER
       Updates every second. START_YEAR drives
       the "years active" stat in the hero panel.
    ───────────────────────────────────────── */
    var yearEl  = document.getElementById('hero-year');
    var clockEl = document.getElementById('hero-clock');

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
        var now = new Date();
        if (yearEl)  yearEl.textContent  = now.getUTCFullYear();
        if (clockEl) clockEl.textContent = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes());
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


    /* ─────────────────────────────────────────
       CURRENCY TOGGLE
       Fetches live USD→GHS rate from open.er-api.com
    ───────────────────────────────────────── */
    var GHS_FALLBACK = 15.5;
    var ghsRate      = GHS_FALLBACK;
    var activeCur    = 'usd';

    function formatPrice(usdAmount, currency, rate) {
        if (currency === 'usd') {
            return '$' + Number(usdAmount).toLocaleString('en-US');
        }
        var ghs = Math.round(usdAmount * rate);
        return '₵' + ghs.toLocaleString('en-US');
    }

    function renderPrices() {
        document.querySelectorAll('.price-val').forEach(function (el) {
            el.textContent = formatPrice(
                parseInt(el.getAttribute('data-usd'), 10),
                activeCur,
                ghsRate
            );
        });
    }

    function switchCurrency(currency) {
        if (currency === activeCur) return;
        activeCur = currency;

        document.querySelectorAll('.cur-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-currency') === currency);
        });

        var priceEls = document.querySelectorAll('.price-val');
        priceEls.forEach(function (el) { el.style.opacity = '0'; });
        setTimeout(function () {
            renderPrices();
            priceEls.forEach(function (el) { el.style.opacity = '1'; });
        }, 150);
    }

    document.querySelectorAll('.cur-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchCurrency(btn.getAttribute('data-currency'));
        });
    });

    async function fetchRate() {
        var rateEl = document.getElementById('cur-rate');
        try {
            var res  = await fetch('https://open.er-api.com/v6/latest/USD');
            var data = await res.json();
            var rate = data && data.rates && data.rates.GHS;
            if (rate && rate > 0) {
                ghsRate = rate;
                if (rateEl) {
                    rateEl.textContent = '1 USD = ₵' + rate.toFixed(2) + ' · live';
                }
            } else {
                throw new Error('no rate');
            }
        } catch (_) {
            if (rateEl) {
                rateEl.textContent = '1 USD ≈ ₵' + GHS_FALLBACK.toFixed(2) + ' · approx';
            }
        }
        if (activeCur === 'ghs') renderPrices();
    }

    fetchRate();


}()); /* SW registration is handled by sw-updater.js */
