/* ─────────────────────────────────────────
   GALLERY — stacked-deck carousel
   Pulls images uploaded from /_p7n3x and shows
   them as a stacked card slider with ‹ › arrows,
   swipe, dots, and a tap-to-open lightbox.
   Managed entirely from the admin — no code edits.
───────────────────────────────────────── */
(function () {
    'use strict';

    var slider  = document.getElementById('cap-slider');
    var stage   = document.getElementById('cap-stage');
    var prevBtn = document.getElementById('cap-prev');
    var nextBtn = document.getElementById('cap-next');
    var dotsWrap = document.getElementById('cap-dots');
    var captionEl = document.getElementById('cap-active-caption');
    var empty   = document.getElementById('cap-empty');
    var countEl = document.getElementById('gallery-count');
    if (!slider || !stage) return;

    // Lightbox
    var lb        = document.getElementById('cap-lightbox');
    var lbImg     = document.getElementById('cap-lb-img');
    var lbCaption = document.getElementById('cap-lb-caption');
    var lbClose   = document.getElementById('cap-lb-close');

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var IMG_ENDPOINT = '/.netlify/functions/get-gallery-image?id=';

    var items  = [];
    var active = 0;
    var cards  = [];

    function setState(s) { slider.setAttribute('data-state', s); }

    function showEmpty() {
        setState('empty');
        if (empty) empty.hidden = false;
        if (countEl) countEl.textContent = '';
        if (dotsWrap) dotsWrap.hidden = true;
    }

    function imgUrl(item) { return IMG_ENDPOINT + encodeURIComponent(item.id); }

    function buildCard(item, index) {
        var el = document.createElement('div');
        el.className = 'cap';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', item.caption || ('Image ' + (index + 1)));

        var frame = document.createElement('div');
        frame.className = 'cap-frame';
        var img = document.createElement('img');
        img.src = imgUrl(item);
        img.alt = item.caption || 'Studio image';
        img.loading = index < 3 ? 'eager' : 'lazy';
        img.draggable = false;
        frame.appendChild(img);
        el.appendChild(frame);

        return el;
    }

    /* Caption lives below the deck so long text wraps fully. */
    var captionTimer = null;
    function updateCaption() {
        if (!captionEl) return;
        var text = (items[active] && items[active].caption) || '';
        if (captionEl.textContent === text) return;
        captionEl.classList.add('fading');
        clearTimeout(captionTimer);
        captionTimer = setTimeout(function () {
            captionEl.textContent = text;
            captionEl.classList.remove('fading');
        }, 180);
    }

    /* ── Positioning — ghost neighbours, no blur ── */
    function positionCards() {
        var n = items.length;
        cards.forEach(function (el, i) {
            var d = i - active;
            if (d > n / 2)  d -= n;
            if (d < -n / 2) d += n;
            var ad = Math.abs(d);
            var sign = d < 0 ? -1 : 1;

            var x = 0, y = 0, rot = 0, scale = 1, op = 1, z = 5;

            if (ad === 0) {
                z = 5;
            } else if (ad === 1) {
                x = sign * 30; y = -22 * sign; rot = sign * 4;
                scale = 0.93; op = 0.2; z = 3;
            } else if (ad === 2) {
                x = sign * 52; y = -40 * sign; rot = sign * 7;
                scale = 0.86; op = 0.1; z = 2;
            } else {
                scale = 0.82; op = 0; z = 1;
            }

            el.style.setProperty('--x', x + 'px');
            el.style.setProperty('--y', y + 'px');
            el.style.setProperty('--rot', rot + 'deg');
            el.style.setProperty('--scale', scale);
            el.style.setProperty('--op', op);
            el.style.setProperty('--z', z);
            el.setAttribute('data-active', ad === 0 ? 'true' : 'false');
        });
        updateDots();
        updateArrows();
        updateCaption();
    }

    function setActive(i) {
        var n = items.length;
        active = ((i % n) + n) % n;
        positionCards();
        restartAuto();
    }
    function next() { if (items.length) setActive(active + 1); }
    function prev() { if (items.length) setActive(active - 1); }

    function updateArrows() {
        var single = items.length <= 1;
        if (prevBtn) prevBtn.disabled = single;
        if (nextBtn) nextBtn.disabled = single;
    }

    /* ── Dots ── */
    function buildDots() {
        if (!dotsWrap) return;
        while (dotsWrap.firstChild) dotsWrap.removeChild(dotsWrap.firstChild);
        if (items.length <= 1) { dotsWrap.hidden = true; return; }
        dotsWrap.hidden = false;
        items.forEach(function (_, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'cap-dot';
            b.setAttribute('aria-label', 'Go to image ' + (i + 1));
            b.addEventListener('click', function () { setActive(i); });
            dotsWrap.appendChild(b);
        });
    }
    function updateDots() {
        if (!dotsWrap) return;
        Array.prototype.forEach.call(dotsWrap.children, function (d, i) {
            d.classList.toggle('active', i === active);
        });
    }

    /* ── Render ── */
    function render(list) {
        items = list;
        active = 0;
        while (stage.firstChild) stage.removeChild(stage.firstChild);
        cards = items.map(function (item, i) {
            var el = buildCard(item, i);
            stage.appendChild(el);
            return el;
        });
        if (empty) empty.hidden = true;
        setState('ready');
        if (countEl) {
            countEl.textContent = items.length + (items.length === 1 ? ' moment' : ' moments');
        }
        buildDots();
        positionCards();
        startAuto();
    }

    /* ── Arrows + keyboard ── */
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    document.addEventListener('keydown', function (e) {
        if (lb && !lb.hidden) {
            if (e.key === 'Escape') closeLightbox();
            return;
        }
        if (!items.length) return;
        var r = slider.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        if (e.key === 'ArrowLeft')  prev();
        if (e.key === 'ArrowRight') next();
    });

    /* ── Tap to open / swipe to navigate ──
       Driven straight off pointer events so a tap reliably opens the
       lightbox and a horizontal drag flips cards. */
    var downX = 0, downY = 0, downT = 0, tracking = false;

    stage.addEventListener('pointerdown', function (e) {
        tracking = true;
        downX = e.clientX; downY = e.clientY; downT = Date.now();
    });

    stage.addEventListener('pointerup', function (e) {
        if (!tracking) return;
        tracking = false;
        var dx = e.clientX - downX;
        var dy = e.clientY - downY;
        var dt = Date.now() - downT;

        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) next(); else prev();
            return;
        }
        // A tap (small movement, quick) on the deck opens the current image.
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 500 && items.length) {
            openLightbox(items[active]);
        }
    });

    stage.addEventListener('pointercancel', function () { tracking = false; });

    /* ── Autoplay ── */
    var autoTimer = null;
    var AUTO_MS = 5000;
    var hovering = false;

    function startAuto() {
        if (reduceMotion || items.length <= 1 || autoTimer) return;
        autoTimer = setInterval(function () {
            if (!document.hidden && (!lb || lb.hidden) && !hovering) setActive(active + 1);
        }, AUTO_MS);
    }
    function restartAuto() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        startAuto();
    }

    slider.addEventListener('mouseenter', function () { hovering = true; });
    slider.addEventListener('mouseleave', function () { hovering = false; });

    /* ── Lightbox ── */
    function openLightbox(item) {
        if (!lb || !item) return;
        lbImg.src = imgUrl(item);
        lbImg.alt = item.caption || 'Studio image';
        lbCaption.textContent = item.caption || '';
        lb.hidden = false;
        lb.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { lb.classList.add('show'); });
        });
    }
    function closeLightbox() {
        if (!lb) return;
        lb.classList.remove('show');
        lb.setAttribute('aria-hidden', 'true');
        setTimeout(function () { lb.hidden = true; lbImg.src = ''; }, 280);
    }
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lb) lb.addEventListener('click', function (e) {
        if (e.target !== lbImg) closeLightbox();
    });

    /* ── Load ── */
    fetch('/.netlify/functions/get-gallery')
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (list) {
            if (!Array.isArray(list) || list.length === 0) { showEmpty(); return; }
            render(list);
        })
        .catch(function () { showEmpty(); });

}());
