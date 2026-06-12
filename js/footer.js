/* ─────────────────────────────────────────
   FOOTER — motion layer
   GSAP-powered reveals, word-mask statement,
   magnetic CTA. Everything here is additive:
   if GSAP fails to load (offline, blocked CDN)
   the footer renders fully without animation.
───────────────────────────────────────── */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Footer clock (GMT, matches hero) ── */
    var clockEl = document.getElementById('ft-clock');
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
        if (!clockEl) return;
        var now = new Date();
        clockEl.textContent = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ' GMT';
    }
    tick();
    setInterval(tick, 30000);

    /* ── Back to top ── */
    var topBtn = document.getElementById('ft-top');
    if (topBtn) {
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    /* ── GSAP layer ── */
    var hasGsap = typeof window.gsap !== 'undefined';
    if (!hasGsap || reduceMotion) return;

    var gsap = window.gsap;
    if (typeof window.ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(window.ScrollTrigger);
    }

    var footer = document.getElementById('footer');
    if (!footer) return;

    /* Statement: split into words, masked rise with stagger */
    var line = document.getElementById('ft-line');
    if (line) {
        var words = line.textContent.split(' ');
        while (line.firstChild) line.removeChild(line.firstChild);
        words.forEach(function (w, i) {
            var mask = document.createElement('span');
            mask.className = 'ft-w';
            var inner = document.createElement('span');
            inner.className = 'ft-w-in';
            inner.textContent = w;
            mask.appendChild(inner);
            line.appendChild(mask);
            if (i < words.length - 1) line.appendChild(document.createTextNode(' '));
        });

        gsap.from(line.querySelectorAll('.ft-w-in'), {
            yPercent: 110,
            duration: 0.85,
            ease: 'power4.out',
            stagger: 0.045,
            scrollTrigger: { trigger: line, start: 'top 92%', once: true }
        });
    }

    /* Section reveals: gentle staggered rise as the footer enters */
    var reveals = footer.querySelectorAll('.ft-reveal');
    if (reveals.length) {
        gsap.from(reveals, {
            y: 26,
            opacity: 0,
            duration: 0.75,
            ease: 'power3.out',
            stagger: 0.09,
            scrollTrigger: { trigger: footer, start: 'top 88%', once: true }
        });
    }

    /* Footer links: tiny cascade after their column lands */
    var links = footer.querySelectorAll('.footer-nav-link');
    if (links.length) {
        gsap.from(links, {
            x: -10,
            opacity: 0,
            duration: 0.45,
            ease: 'power2.out',
            stagger: 0.04,
            scrollTrigger: { trigger: footer, start: 'top 80%', once: true }
        });
    }

    /* Magnetic CTA — desktop pointers only */
    var cta = footer.querySelector('.footer-cta');
    if (cta && window.matchMedia('(pointer: fine)').matches) {
        var PULL = 0.35;
        cta.addEventListener('mousemove', function (e) {
            var r = cta.getBoundingClientRect();
            gsap.to(cta, {
                x: (e.clientX - r.left - r.width / 2) * PULL,
                y: (e.clientY - r.top - r.height / 2) * PULL,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
        cta.addEventListener('mouseleave', function () {
            gsap.to(cta, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.45)' });
        });
    }

}());
