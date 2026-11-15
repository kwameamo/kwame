/* ─────────────────────────────────────────────────────────────
   LIQUID GLASS — engine
   Pairs with css/glass.css. For every glass pane on the page:

   • Edge refraction (Chromium): builds an SVG displacement map
     the size of the pane. Content under the rim is bent inward;
     the bend is strongest at the edge and fades to nothing
     EDGE px in, so the centre stays flat. The red channel is
     displaced 15% more than blue, which puts a faint spectral
     fringe on the rim. Edge width 44px, the lens profile is
     laid out over 1.1× that width so it never plateaus.

   • Backdrop sampling (every browser): reads nine points of
     whatever sits under the pane — images are read through a
     tiny canvas, everything else from computed background
     colours — then
       mean luminance < 0.5  →  dark glass (data-lg="dark")
       spread of the samples →  tint concentration (--lg-alpha)
     within the tuned ranges: white 6–22%, rgb(20 20 24) 16–38%.

   Panes are found by the same selector list css/glass.css
   styles; anything added later with class "lg" is picked up
   by a MutationObserver. window.LiquidGlass.refresh() forces
   a resample (used after layout changes the engine can't see).
───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var SEL = '.lg, .site-nav, .cs-nav, .modal-close, .modal-nav-btn, .mf-btn, .glass-btn, .modal-nav-counter';

    var EDGE       = 44;    // px, refraction edge width
    var EDGE_OFF   = 1.1;   // lens profile spans EDGE × 1.1 from a virtual edge just outside the pane
    var DISPERSION = 0.15;  // red bends +15%, blue −15%

    var LIGHT = { min: 0.06, max: 0.22 };
    var DARK  = { min: 0.16, max: 0.38 };
    var DARK_BELOW  = 0.47; // hysteresis around the 0.5 switch
    var LIGHT_ABOVE = 0.53;

    var ua = navigator.userAgent;
    var refracts = /Chrome\//.test(ua) && !/CriOS|FxiOS/.test(ua) &&
        ('backdropFilter' in document.documentElement.style);
    var reducedTransparency = window.matchMedia &&
        window.matchMedia('(prefers-reduced-transparency: reduce)').matches;

    var NS = 'http://www.w3.org/2000/svg';
    var XLINK = 'http://www.w3.org/1999/xlink';
    var svg = null;
    var panes = [];
    var seq = 0;

    function defsRoot() {
        if (svg) return svg;
        svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        document.body.appendChild(svg);
        return svg;
    }

    /* ── 3. Edge refraction ─────────────────────────────── */

    var mapCache = {};

    // Signed distance from the inside of a rounded rectangle, encoded as a
    // normal map: R = x push, G = y push, 128 = none. Push grows toward the
    // edge with a squared falloff laid out over EDGE_OFF × bezel.
    function buildMap(w, h, r, bezel) {
        var key = w + ':' + h + ':' + r + ':' + bezel;
        if (mapCache[key]) return mapCache[key];

        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        var img = ctx.createImageData(w, h);
        var d = img.data;
        var cx = w / 2, cy = h / 2;
        var ix = w / 2 - r, iy = h / 2 - r;
        var span = bezel * EDGE_OFF;
        var shift = span - bezel;

        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var px = x + 0.5 - cx, py = y + 0.5 - cy;
                var qx = Math.abs(px) - ix, qy = Math.abs(py) - iy;
                var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
                var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
                var len = Math.sqrt(ox * ox + oy * oy);
                var t = -(len + Math.min(Math.max(qx, qy), 0) - r); // depth in from the edge

                var nx = 0, ny = 0, m = 0;
                if (t >= 0 && t < bezel) {
                    if (qx > 0 && qy > 0 && len > 0) { nx = sx * ox / len; ny = sy * oy / len; }
                    else if (qx > qy) { nx = sx; }
                    else { ny = sy; }
                    var k = 1 - (t + shift) / span;
                    m = k * k;
                }

                var i = (y * w + x) * 4;
                d[i]     = Math.round(128 + nx * m * 127);
                d[i + 1] = Math.round(128 + ny * m * 127);
                d[i + 2] = 128;
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        var url = c.toDataURL('image/png');
        mapCache[key] = url;
        return url;
    }

    function channelMatrix(ch) {
        var rows = ['0 0 0 0 0', '0 0 0 0 0', '0 0 0 0 0'];
        rows[ch] = ch === 0 ? '1 0 0 0 0' : ch === 1 ? '0 1 0 0 0' : '0 0 1 0 0';
        return rows.join(' ') + ' 0 0 0 1 0';
    }

    function makeFilter(id) {
        var filter = document.createElementNS(NS, 'filter');
        filter.setAttribute('id', id);
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('color-interpolation-filters', 'sRGB');

        var feImage = document.createElementNS(NS, 'feImage');
        feImage.setAttribute('preserveAspectRatio', 'none');
        feImage.setAttribute('result', 'map');
        filter.appendChild(feImage);

        // One displacement per channel, then the channels are re-combined.
        var disps = [];
        ['r', 'g', 'b'].forEach(function (name, ch) {
            var disp = document.createElementNS(NS, 'feDisplacementMap');
            disp.setAttribute('in', 'SourceGraphic');
            disp.setAttribute('in2', 'map');
            disp.setAttribute('xChannelSelector', 'R');
            disp.setAttribute('yChannelSelector', 'G');
            disp.setAttribute('result', 'd' + name);
            filter.appendChild(disp);
            disps.push(disp);

            var cm = document.createElementNS(NS, 'feColorMatrix');
            cm.setAttribute('in', 'd' + name);
            cm.setAttribute('type', 'matrix');
            cm.setAttribute('values', channelMatrix(ch));
            cm.setAttribute('result', 'c' + name);
            filter.appendChild(cm);
        });

        var b1 = document.createElementNS(NS, 'feBlend');
        b1.setAttribute('in', 'cr');
        b1.setAttribute('in2', 'cg');
        b1.setAttribute('mode', 'screen');
        b1.setAttribute('result', 'rg');
        filter.appendChild(b1);

        var b2 = document.createElementNS(NS, 'feBlend');
        b2.setAttribute('in', 'rg');
        b2.setAttribute('in2', 'cb');
        b2.setAttribute('mode', 'screen');
        filter.appendChild(b2);

        defsRoot().appendChild(filter);
        return { filter: filter, image: feImage, disps: disps };
    }

    /* ── 4 + 7. Backdrop sampling ───────────────────────── */

    var SAMPLE = 20; // px, luminance grid per image
    var lumCache = new WeakMap(); // img/element → { lum: Float32Array, ok }
    var corsClones = {};          // url → Image loaded with crossOrigin

    function luminance(r, g, b) {
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    function readImage(source) {
        // Draw the image into a tiny canvas and keep its luminance grid.
        var cached = lumCache.get(source);
        if (cached) return cached;
        var entry = { lum: null, ok: false };
        try {
            var c = document.createElement('canvas');
            c.width = SAMPLE; c.height = SAMPLE;
            var ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);
            var d = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
            var lum = new Float32Array(SAMPLE * SAMPLE);
            for (var i = 0; i < SAMPLE * SAMPLE; i++) {
                var a = d[i * 4 + 3] / 255;
                // Transparent pixels fall back to white paper
                lum[i] = luminance(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) * a + (1 - a);
            }
            entry.lum = lum;
            entry.ok = true;
        } catch (_) {
            entry.ok = false; // tainted canvas (cross-origin)
        }
        lumCache.set(source, entry);
        return entry;
    }

    function corsImage(url) {
        var clone = corsClones[url];
        if (clone) return clone.complete && clone.naturalWidth ? clone : null;
        clone = new Image();
        clone.crossOrigin = 'anonymous';
        clone.decoding = 'async';
        clone.addEventListener('load', schedule);
        clone.src = url;
        corsClones[url] = clone;
        return null;
    }

    // Luminance and local spread of an image at a relative point.
    function imageAt(img, rx, ry) {
        if (!img.complete || !img.naturalWidth) return null;
        var entry = readImage(img);
        if (!entry.ok) {
            // Try again through a CORS-enabled copy of the same file.
            var clone = corsImage(img.currentSrc || img.src);
            if (!clone) return { l: 0.5, s: 0.35 };
            entry = readImage(clone);
            if (!entry.ok) return { l: 0.5, s: 0.35 };
        }
        return gridAt(entry.lum, rx, ry);
    }

    function gridAt(lum, rx, ry) {
        var gx = Math.min(SAMPLE - 1, Math.max(0, Math.floor(rx * SAMPLE)));
        var gy = Math.min(SAMPLE - 1, Math.max(0, Math.floor(ry * SAMPLE)));
        var sum = 0, sq = 0, n = 0;
        for (var y = gy - 1; y <= gy + 1; y++) {
            for (var x = gx - 1; x <= gx + 1; x++) {
                if (x < 0 || y < 0 || x >= SAMPLE || y >= SAMPLE) continue;
                var v = lum[y * SAMPLE + x];
                sum += v; sq += v * v; n++;
            }
        }
        var mean = sum / n;
        var sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
        return { l: lum[gy * SAMPLE + gx], s: sd };
    }

    // Object-fit: cover mapping from an element box to image pixels
    function coverPoint(el, img, x, y) {
        var box = el.getBoundingClientRect();
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw || !ih || !box.width || !box.height) return { rx: 0.5, ry: 0.5 };
        var fit = styleOf(el).objectFit;
        var sx = box.width / iw, sy = box.height / ih;
        var s = fit === 'contain' ? Math.min(sx, sy) : fit === 'fill' || fit === 'none' ? null : Math.max(sx, sy);
        if (s === null) return { rx: (x - box.left) / box.width, ry: (y - box.top) / box.height };
        var dw = iw * s, dh = ih * s;
        var ox = box.left + (box.width - dw) / 2, oy = box.top + (box.height - dh) / 2;
        return { rx: (x - ox) / dw, ry: (y - oy) / dh };
    }

    var rgbRe = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/;
    function parseColor(str) {
        var m = rgbRe.exec(str || '');
        if (!m) return null;
        var a = m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
        return { l: luminance(+m[1], +m[2], +m[3]), a: a };
    }

    var bgUrlRe = /url\(["']?([^"')]+)["']?\)/;
    var styleCache = null; // element → computed style, for the duration of one run

    function styleOf(el) {
        if (!styleCache) return getComputedStyle(el);
        var cs = styleCache.get(el);
        if (!cs) { cs = getComputedStyle(el); styleCache.set(el, cs); }
        return cs;
    }

    // What is visibly painted at (x, y), ignoring glass panes themselves.
    function probe(x, y) {
        var stack = document.elementsFromPoint(x, y);
        var acc = null; // running composite from the top down: { l, s, a }
        for (var i = 0; i < stack.length; i++) {
            var el = stack[i];
            if (el.closest && el.closest(SEL)) continue;

            var hit = null;
            if (el.tagName === 'IMG') {
                var p = coverPoint(el, el, x, y);
                var v = imageAt(el, p.rx, p.ry);
                if (v) hit = { l: v.l, s: v.s, a: 1 };
            } else if (el.tagName === 'VIDEO' || el.tagName === 'CANVAS') {
                hit = { l: 0.35, s: 0.3, a: 1 };
            } else {
                var cs = styleOf(el);
                var bgi = cs.backgroundImage;
                var m = bgi && bgi !== 'none' ? bgUrlRe.exec(bgi) : null;
                if (m && !/^data:image\/svg/.test(m[1])) {
                    var clone = corsImage(m[1]);
                    if (clone) {
                        var r = el.getBoundingClientRect();
                        var pt = { rx: (x - r.left) / r.width, ry: (y - r.top) / r.height };
                        var e = readImage(clone);
                        if (e.ok) { var g = gridAt(e.lum, pt.rx, pt.ry); hit = { l: g.l, s: g.s, a: 1 }; }
                        else hit = { l: 0.5, s: 0.35, a: 1 };
                    } else {
                        hit = { l: 0.5, s: 0.35, a: 1 };
                    }
                } else if (bgi && /gradient/.test(bgi)) {
                    hit = { l: 0.5, s: 0.15, a: 1 };
                } else {
                    var col = parseColor(cs.backgroundColor);
                    if (col && col.a > 0) hit = { l: col.l, s: 0, a: col.a };
                }
            }
            if (!hit) continue;
            acc = composite(acc, hit);
            if (acc.a >= 0.98) break;
        }
        if (!acc) return { l: 1, s: 0 };
        // Anything still showing through is the page's white
        var rest = 1 - acc.a;
        return { l: acc.l + rest, s: acc.s };
    }

    function composite(top, under) {
        if (!top) return { l: under.l * under.a, s: under.s * under.a, a: under.a };
        var rest = 1 - top.a;
        return {
            l: top.l + under.l * under.a * rest,
            s: top.s + under.s * under.a * rest,
            a: top.a + under.a * rest
        };
    }

    function samplePane(pane) {
        var el = pane.el;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;

        var fr = [0.16, 0.5, 0.84];
        var ls = [], spread = 0, n = 0;
        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 3; j++) {
                var x = r.left + r.width * fr[j];
                var y = r.top + r.height * fr[i];
                if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
                var v = probe(x, y);
                ls.push(v.l);
                spread += v.s;
                n++;
            }
        }
        if (!n) return;

        var mean = 0;
        for (i = 0; i < ls.length; i++) mean += ls[i];
        mean /= ls.length;
        var varc = 0;
        for (i = 0; i < ls.length; i++) varc += (ls[i] - mean) * (ls[i] - mean);
        var sd = Math.sqrt(varc / ls.length);
        var local = spread / n;

        // Complexity: how uneven the backdrop is, across the pane and within it.
        var complexity = Math.min(1, Math.max(sd * 3.2, local * 3.6));

        var dark = pane.dark;
        if (dark && mean > LIGHT_ABOVE) dark = false;
        else if (!dark && mean < DARK_BELOW) dark = true;
        pane.dark = dark;

        var range = dark ? DARK : LIGHT;
        var alpha = range.min + (range.max - range.min) * complexity;

        if (dark) el.setAttribute('data-lg', 'dark');
        else el.removeAttribute('data-lg');
        el.style.setProperty('--lg-alpha', alpha.toFixed(3));
    }

    /* ── Pane setup ─────────────────────────────────────── */

    function setupRefraction(pane) {
        var el = pane.el;
        var id = 'lg-' + (++seq);
        var parts = makeFilter(id);
        pane.filter = parts;

        var lastW = 0, lastH = 0;

        pane.resize = function () {
            var w = Math.round(el.offsetWidth);
            var h = Math.round(el.offsetHeight);
            if (!w || !h || (w === lastW && h === lastH)) return;
            lastW = w; lastH = h;

            var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2;
            radius = Math.min(radius, h / 2, w / 2);
            var bezel = Math.min(EDGE, Math.floor(Math.min(w, h) / 2));
            var scale = Math.max(10, Math.min(34, bezel * 0.8));
            var url = buildMap(w, h, radius, bezel);

            [parts.filter, parts.image].forEach(function (node) {
                node.setAttribute('x', '0');
                node.setAttribute('y', '0');
                node.setAttribute('width', String(w));
                node.setAttribute('height', String(h));
            });
            parts.image.setAttribute('href', url);
            parts.image.setAttributeNS(XLINK, 'xlink:href', url);
            parts.disps[0].setAttribute('scale', (scale * (1 + DISPERSION)).toFixed(2));
            parts.disps[1].setAttribute('scale', scale.toFixed(2));
            parts.disps[2].setAttribute('scale', (scale * (1 - DISPERSION)).toFixed(2));

            var f = 'url(#' + id + ') blur(var(--lg-blur)) saturate(var(--lg-sat)) brightness(var(--lg-bright))';
            el.style.setProperty('--lg-blur', '2px');
            el.style.webkitBackdropFilter = f;
            el.style.backdropFilter = f;
            el.classList.add('lg-refract');
        };

        if ('ResizeObserver' in window) {
            pane.ro = new ResizeObserver(function () { pane.resize(); schedule(); });
            pane.ro.observe(el);
        }
        pane.resize();
    }

    function addPane(el) {
        if (el.__lgPane) return;
        var pane = { el: el, dark: false };
        el.__lgPane = pane;
        panes.push(pane);
        if (refracts && !reducedTransparency) setupRefraction(pane);
        else if ('ResizeObserver' in window) {
            pane.ro = new ResizeObserver(schedule);
            pane.ro.observe(el);
        }
    }

    function scan(root) {
        var list = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
        if (root.matches && root.matches(SEL)) addPane(root);
        Array.prototype.forEach.call(list, addPane);
    }

    /* ── Scheduling ─────────────────────────────────────── */

    var raf = 0, last = 0, pending = false;
    var MIN_GAP = 90;

    function run() {
        raf = 0;
        last = performance.now();
        pending = false;
        styleCache = typeof Map === 'function' ? new Map() : null;
        for (var i = panes.length - 1; i >= 0; i--) {
            var p = panes[i];
            if (!p.el.isConnected) {
                if (p.ro) p.ro.disconnect();
                if (p.filter) p.filter.filter.remove();
                panes.splice(i, 1);
                continue;
            }
            samplePane(p);
        }
        styleCache = null;
    }

    function schedule() {
        if (reducedTransparency) return;
        if (raf) return;
        var wait = Math.max(0, MIN_GAP - (performance.now() - last));
        if (wait > 0) {
            if (pending) return;
            pending = true;
            setTimeout(function () { pending = false; schedule(); }, wait);
            return;
        }
        raf = requestAnimationFrame(run);
    }

    function init() {
        scan(document);
        if ('MutationObserver' in window) {
            new MutationObserver(function (muts) {
                var changed = false;
                for (var i = 0; i < muts.length; i++) {
                    var m = muts[i];
                    if (m.type === 'childList') {
                        var nodes = m.addedNodes;
                        for (var j = 0; j < nodes.length; j++) {
                            if (nodes[j].nodeType === 1) { scan(nodes[j]); changed = true; }
                        }
                        if (m.removedNodes.length) changed = true;
                    } else if (m.type === 'attributes') {
                        // Our own writes to a pane (--lg-alpha, data-lg, backdrop-filter)
                        // must not re-trigger sampling; a class change still may.
                        var t = m.target;
                        var own = t.nodeType === 1 && t.closest && t.closest(SEL) && m.attributeName !== 'class';
                        if (!own) changed = true;
                    }
                }
                if (changed) schedule();
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'src'] });
        }

        window.addEventListener('scroll', schedule, { passive: true, capture: true });
        window.addEventListener('resize', schedule);
        document.addEventListener('load', schedule, true); // images arriving
        document.addEventListener('transitionend', schedule, true);
        document.addEventListener('animationend', schedule, true);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
        schedule();
        setTimeout(schedule, 400);
        setTimeout(schedule, 1200);
    }

    window.LiquidGlass = {
        refresh: function () { last = 0; schedule(); },
        scan: scan
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
