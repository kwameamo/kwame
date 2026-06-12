/* ─────────────────────────────────────────
   GALLERY — stacked-deck carousel
   Pulls images uploaded from /_p7n3x and shows
   them as a stacked card slider with ‹ › arrows,
   drag-follow swipe, dots, and a lightbox with
   its own prev/next. Cards are positioned by
   continuous pose interpolation so dragging
   tracks the finger 1:1 and settles smoothly.
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
    var lbPrev    = document.getElementById('cap-lb-prev');
    var lbNext    = document.getElementById('cap-lb-next');

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

    /* ── Pose interpolation ──
       Keyframe poses at integer stack depths; fractional depths lerp
       between them, which lets the deck follow a drag continuously. */
    var POSES = [
        { x: 0,  y: 0,  rot: 0, scale: 1,    op: 1,    blur: 0   },
        { x: 30, y: 22, rot: 4, scale: 0.93, op: 0.22, blur: 1.5 },
        { x: 52, y: 40, rot: 7, scale: 0.86, op: 0.1,  blur: 3   },
        { x: 62, y: 48, rot: 9, scale: 0.82, op: 0,    blur: 4   }
    ];

    function lerp(a, b, t) { return a + (b - a) * t; }

    function applyPose(el, d) {
        var sign = d < 0 ? -1 : 1;
        var ad = Math.min(Math.abs(d), POSES.length - 1);
        var i = Math.min(Math.floor(ad), POSES.length - 2);
        var t = ad - i;
        var a = POSES[i], b = POSES[i + 1];

        el.style.setProperty('--x', (sign * lerp(a.x, b.x, t)).toFixed(2) + 'px');
        el.style.setProperty('--y', (-sign * lerp(a.y, b.y, t)).toFixed(2) + 'px');
        el.style.setProperty('--rot', (sign * lerp(a.rot, b.rot, t)).toFixed(2) + 'deg');
        el.style.setProperty('--scale', lerp(a.scale, b.scale, t).toFixed(4));
        el.style.setProperty('--op', lerp(a.op, b.op, t).toFixed(3));
        el.style.setProperty('--blur', lerp(a.blur, b.blur, t).toFixed(2) + 'px');
        // Stacking: closer to front = higher. Scaled to keep integers distinct.
        el.style.setProperty('--z', String(Math.round((POSES.length - ad) * 10)));
        el.setAttribute('data-active', ad < 0.5 ? 'true' : 'false');
    }

    /* Render the deck at a continuous position (active + offset).
       offset 0 = settled; offset ±0..1 = mid-drag toward next/prev. */
    function renderAt(offset) {
        var n = items.length;
        cards.forEach(function (el, i) {
            var d = i - active - offset;
            if (n > 1) {
                while (d > n / 2)  d -= n;
                while (d < -n / 2) d += n;
            }
            applyPose(el, d);
        });
    }

    function positionCards() {
        renderAt(0);
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
            if (e.key === 'Escape')     closeLightbox();
            if (e.key === 'ArrowLeft')  lbStep(-1);
            if (e.key === 'ArrowRight') lbStep(1);
            return;
        }
        if (!items.length) return;
        var r = slider.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        if (e.key === 'ArrowLeft')  prev();
        if (e.key === 'ArrowRight') next();
    });

    /* ── Drag-follow swipe / tap ──
       The deck tracks the pointer 1:1 during a horizontal drag
       (transitions off), then settles with a spring transition. */
    var DRAG_WIDTH = 280;     // px of drag for a full card flip
    var drag = null;          // { x0, y0, t0, horizontal }

    function setDragging(on) {
        stage.classList.toggle('dragging', on);
    }

    stage.addEventListener('pointerdown', function (e) {
        if (!items.length) return;
        drag = { x0: e.clientX, y0: e.clientY, t0: Date.now(), horizontal: false };
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    });

    stage.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x0;
        var dy = e.clientY - drag.y0;
        if (!drag.horizontal) {
            if (Math.abs(dx) < 8) return;                 // dead zone
            if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // vertical scroll wins
            drag.horizontal = true;
            setDragging(true);
            if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        }
        var offset = -dx / DRAG_WIDTH;
        // Soft resistance past one card
        if (offset > 1)  offset = 1  + (offset - 1) * 0.3;
        if (offset < -1) offset = -1 + (offset + 1) * 0.3;
        renderAt(offset);
    });

    function endDrag(e) {
        if (!drag) return;
        var d = drag; drag = null;
        var dx = e.clientX - d.x0;
        var dy = e.clientY - d.y0;
        var dt = Math.max(Date.now() - d.t0, 1);

        if (d.horizontal) {
            setDragging(false);
            var offset = -dx / DRAG_WIDTH;
            var velocity = dx / dt; // px per ms
            if (offset > 0.25 || velocity < -0.45)      setActive(active + 1);
            else if (offset < -0.25 || velocity > 0.45) setActive(active - 1);
            else { renderAt(0); restartAuto(); }
            return;
        }

        // Tap: quick, no real movement → open the active image.
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 500) {
            openLightbox(active);
        }
    }

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', function () {
        if (drag && drag.horizontal) { setDragging(false); renderAt(0); restartAuto(); }
        drag = null;
    });

    /* ── Autoplay ── */
    var autoTimer = null;
    var AUTO_MS = 5000;
    var hovering = false;

    function startAuto() {
        if (reduceMotion || items.length <= 1 || autoTimer) return;
        autoTimer = setInterval(function () {
            if (!document.hidden && (!lb || lb.hidden) && !hovering && !drag) {
                setActive(active + 1);
            }
        }, AUTO_MS);
    }
    function restartAuto() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        startAuto();
    }

    slider.addEventListener('mouseenter', function () { hovering = true; });
    slider.addEventListener('mouseleave', function () { hovering = false; });

    /* ── Lightbox (with its own prev/next) ── */
    var lbIndex = 0;
    var lbFadeTimer = null;

    function lbShow(index) {
        lbIndex = ((index % items.length) + items.length) % items.length;
        var item = items[lbIndex];
        lbImg.src = imgUrl(item);
        lbImg.alt = item.caption || 'Studio image';
        lbCaption.textContent = item.caption || '';
        var single = items.length <= 1;
        if (lbPrev) lbPrev.hidden = single;
        if (lbNext) lbNext.hidden = single;
    }

    function lbStep(dir) {
        if (!items.length || !lb || lb.hidden) return;
        // Quick cross-fade while the new image loads
        lbImg.classList.add('switching');
        clearTimeout(lbFadeTimer);
        lbFadeTimer = setTimeout(function () {
            lbShow(lbIndex + dir);
            setActive(lbIndex); // keep the deck in sync behind the lightbox
            lbImg.classList.remove('switching');
        }, 140);
    }

    function openLightbox(index) {
        if (!lb || !items.length) return;
        lbShow(index);
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
    if (lbPrev)  lbPrev.addEventListener('click', function () { lbStep(-1); });
    if (lbNext)  lbNext.addEventListener('click', function () { lbStep(1); });
    if (lb) lb.addEventListener('click', function (e) {
        if (e.target === lb || e.target.classList.contains('cap-lb-inner')) closeLightbox();
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
