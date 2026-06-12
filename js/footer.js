/* ─────────────────────────────────────────
   FOOTER — motion layer
   Inversion orb (mix-blend difference circle
   that chases the cursor / drifts on touch),
   text decode on the statement + link hovers,
   GSAP reveals, magnetic CTA. Everything is
   additive: without JS or GSAP the footer
   renders fully static.
───────────────────────────────────────── */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var footer = document.getElementById('footer');

    /* ── Clock (GMT, with seconds, matches hero) ── */
    var clockEl = document.getElementById('ft-clock');
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
        if (!clockEl) return;
        var now = new Date();
        clockEl.textContent =
            pad(now.getUTCHours()) + ':' +
            pad(now.getUTCMinutes()) + ':' +
            pad(now.getUTCSeconds()) + ' GMT';
    }
    tick();
    setInterval(tick, 1000);

    /* ── Back to top ── */
    var topBtn = document.getElementById('ft-top');
    if (topBtn) {
        topBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    if (!footer || reduceMotion) return;

    /* ── Text decode ──
       Letters resolve left to right out of a scramble. Spaces and
       punctuation stay put so the layout never jitters. */
    var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#*+/✦';
    function randGlyph() { return GLYPHS[(Math.random() * GLYPHS.length) | 0]; }

    function decode(el, duration, done) {
        if (el.dataset.fxRunning) return;
        el.dataset.fxRunning = '1';
        var original = el.dataset.fxText || el.textContent;
        el.dataset.fxText = original;
        var chars = original.split('');
        var start = null;

        function frame(ts) {
            if (start === null) start = ts;
            var p = Math.min((ts - start) / duration, 1);
            var resolved = Math.floor(p * chars.length);
            var out = '';
            for (var i = 0; i < chars.length; i++) {
                var c = chars[i];
                if (i < resolved || c === ' ' || c === '—' || c === '·' || c === ',' || c === '.') {
                    out += c;
                } else {
                    out += randGlyph();
                }
            }
            el.textContent = out;
            if (p < 1) {
                requestAnimationFrame(frame);
            } else {
                el.textContent = original;
                delete el.dataset.fxRunning;
                el.dataset.fxDone = '1';
                if (done) done();
            }
        }
        requestAnimationFrame(frame);
    }

    // Statement decodes when the footer scrolls into view
    var line = document.getElementById('ft-line');
    if (line && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) {
                io.disconnect();
                decode(line, 1300);
            }
        }, { threshold: 0.4 });
        io.observe(line);
    }

    // Links decode on hover (fine pointers — pointless on touch)
    if (window.matchMedia('(pointer: fine)').matches) {
        footer.querySelectorAll('.footer-nav-link').forEach(function (a) {
            a.addEventListener('mouseenter', function () { decode(a, 350); });
        });
    }

    /* ── Inversion orb ── */
    var orb = document.getElementById('ft-orb');
    if (orb) {
        var fine = window.matchMedia('(pointer: fine)').matches;
        var pos = { x: 0, y: 0 };       // rendered position
        var target = { x: 0, y: 0 };    // where it wants to be
        var scale = 0, targetScale = 0;
        var rafId = null;

        function renderOrb() {
            pos.x += (target.x - pos.x) * 0.08;
            pos.y += (target.y - pos.y) * 0.08;
            scale += (targetScale - scale) * 0.1;
            orb.style.transform =
                'translate(' + (pos.x - 100) + 'px,' + (pos.y - 100) + 'px) scale(' + scale.toFixed(3) + ')';
            if (Math.abs(target.x - pos.x) > 0.1 || Math.abs(target.y - pos.y) > 0.1 ||
                Math.abs(targetScale - scale) > 0.001 || targetScale > 0) {
                rafId = requestAnimationFrame(renderOrb);
            } else {
                rafId = null;
            }
        }
        function wake() { if (!rafId) rafId = requestAnimationFrame(renderOrb); }

        if (fine) {
            // Desktop: the orb chases the cursor with lag
            footer.addEventListener('mouseenter', function (e) {
                var r = footer.getBoundingClientRect();
                pos.x = target.x = e.clientX - r.left;
                pos.y = target.y = e.clientY - r.top;
                targetScale = 1;
                wake();
            });
            footer.addEventListener('mousemove', function (e) {
                var r = footer.getBoundingClientRect();
                target.x = e.clientX - r.left;
                target.y = e.clientY - r.top;
                wake();
            });
            footer.addEventListener('mouseleave', function () {
                targetScale = 0;
                wake();
            });
        } else {
            // Touch: the orb drifts on its own slow path while visible
            var drifting = false;
            var t0 = 0;
            function drift(ts) {
                if (!drifting) return;
                if (!t0) t0 = ts;
                var t = (ts - t0) / 1000;
                var w = footer.offsetWidth, h = footer.offsetHeight;
                target.x = w * 0.5 + w * 0.38 * Math.sin(t * 0.27);
                target.y = h * 0.5 + h * 0.34 * Math.sin(t * 0.19 + 1.7);
                wake();
                requestAnimationFrame(drift);
            }
            if ('IntersectionObserver' in window) {
                new IntersectionObserver(function (entries) {
                    var vis = entries[0].isIntersecting;
                    if (vis && !drifting) {
                        drifting = true;
                        pos.x = target.x = footer.offsetWidth / 2;
                        pos.y = target.y = footer.offsetHeight / 2;
                        targetScale = 0.8;
                        requestAnimationFrame(drift);
                    } else if (!vis && drifting) {
                        drifting = false;
                        t0 = 0;
                        targetScale = 0;
                        wake();
                    }
                }, { threshold: 0.2 }).observe(footer);
            }
        }
    }

    /* ── GSAP layer (reveals + magnetic CTA) ── */
    if (typeof window.gsap === 'undefined') return;
    var gsap = window.gsap;
    if (typeof window.ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(window.ScrollTrigger);
    }

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
