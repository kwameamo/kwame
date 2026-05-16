(function () {
    'use strict';

    /* ─────────────────────────────────────────
       HERO CLOCK + YEAR COUNTER
       Updates every second. START_YEAR drives
       the "years active" stat in the hero panel.
    ───────────────────────────────────────── */
    var START_YEAR  = 2021;
    var yearEl      = document.getElementById('hero-year');
    var clockEl     = document.getElementById('hero-clock');
    var statYearsEl = document.getElementById('stat-years');

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
        var now = new Date();
        var currentYear = now.getUTCFullYear();

        if (yearEl)      yearEl.textContent      = currentYear;
        if (clockEl)     clockEl.textContent      = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes());
        if (statYearsEl) statYearsEl.textContent  = (currentYear - START_YEAR) + '+';
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


    /* ─────────────────────────────────────────
       INQUIRY FORM — FormSubmit AJAX
       Endpoint: https://formsubmit.co/ajax/{email}
    ───────────────────────────────────────── */
    var form      = document.getElementById('inquire-form');
    var submitBtn = document.getElementById('f-submit-btn');
    var successEl = document.getElementById('f-success');
    var errorEl   = document.getElementById('f-error');

    var SUBMIT_URL = 'https://formsubmit.co/ajax/kwameallday@gmail.com';

    function setSubmitting(loading) {
        if (!submitBtn) return;
        submitBtn.disabled = loading;
        submitBtn.textContent = loading ? 'Sending…' : 'Send Inquiry →';
    }

    function showError() {
        if (errorEl) errorEl.classList.add('show');
        setSubmitting(false);
    }

    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            /* Basic HTML5 validation gate */
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            setSubmitting(true);

            /* Build payload — combine first + last name */
            var fd = new FormData(form);
            var firstName = (fd.get('first_name') || '').trim();
            var lastName  = (fd.get('last_name')  || '').trim();
            var payload   = {
                name:         [firstName, lastName].filter(Boolean).join(' '),
                email:        fd.get('email')        || '',
                whatsapp:     fd.get('whatsapp')     || '',
                project_type: fd.get('project_type') || '',
                budget:       fd.get('budget')       || '',
                message:      fd.get('message')      || '',
                _subject:     'New commission inquiry — ' + firstName + ' ' + lastName,
                _captcha:     'false',
                _template:    'table',
            };

            /* Drop empty optional fields to keep the email clean */
            if (!payload.whatsapp) delete payload.whatsapp;
            if (!payload.budget)   delete payload.budget;

            try {
                var res    = await fetch(SUBMIT_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept':       'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                var result = await res.json();

                if (result.success === 'true' || result.success === true) {
                    form.style.display  = 'none';
                    if (successEl) successEl.classList.add('show');
                } else {
                    showError();
                }
            } catch (_) {
                showError();
            }
        });
    }


    /* ─────────────────────────────────────────
       SERVICE WORKER
    ───────────────────────────────────────── */
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }

}());
