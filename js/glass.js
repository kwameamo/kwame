/* ─────────────────────────────────────────
   LIQUID GLASS — edge refraction (Chromium)
   For every glass surface (header pill, blog buttons)
   this builds an SVG displacement map matching the
   element's size: content under the rim is pushed
   toward the edge, like light bending through a
   thick glass lens. Other browsers keep the CSS
   frosted-glass fallback.
───────────────────────────────────────── */
(function () {
    'use strict';

    var ua = navigator.userAgent;
    var supported = /Chrome\//.test(ua) && !/CriOS|FxiOS/.test(ua) &&
        'backdropFilter' in document.documentElement.style;
    if (!supported) return;

    var targets = document.querySelectorAll(
        '.site-nav, .cs-nav, .modal-close, .modal-nav-btn, .mf-btn, .glass-btn');
    if (!targets.length) return;

    var NS = 'http://www.w3.org/2000/svg';

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;pointer-events:none';
    document.body.appendChild(svg);

    function buildMap(w, h, r, bezel) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        var img = ctx.createImageData(w, h);
        var d = img.data;
        var cx = w / 2, cy = h / 2;
        var ix = w / 2 - r, iy = h / 2 - r;

        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var px = x + 0.5 - cx, py = y + 0.5 - cy;
                var qx = Math.abs(px) - ix, qy = Math.abs(py) - iy;
                var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
                var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
                var len = Math.sqrt(ox * ox + oy * oy);
                var t = -(len + Math.min(Math.max(qx, qy), 0) - r); // depth from edge

                var nx = 0, ny = 0, m = 0;
                if (t >= 0 && t < bezel) {
                    if (qx > 0 && qy > 0 && len > 0) { nx = sx * ox / len; ny = sy * oy / len; }
                    else if (qx > qy) { nx = sx; }
                    else { ny = sy; }
                    var k = 1 - t / bezel;
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
        return c.toDataURL('image/png');
    }

    function setup(el, index) {
        var isNav = el.classList.contains('site-nav') || el.classList.contains('cs-nav');
        var id = isNav ? 'lg-filter' : 'lg-btn-' + index;
        var bezel = isNav ? 18 : 10;
        var scale = isNav ? 38 : 26;
        var blur = isNav ? 4 : 3;

        var filter = document.createElementNS(NS, 'filter');
        filter.setAttribute('id', id);
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('color-interpolation-filters', 'sRGB');

        var feImage = document.createElementNS(NS, 'feImage');
        feImage.setAttribute('preserveAspectRatio', 'none');
        feImage.setAttribute('result', 'map');

        var disp = document.createElementNS(NS, 'feDisplacementMap');
        disp.setAttribute('in', 'SourceGraphic');
        disp.setAttribute('in2', 'map');
        disp.setAttribute('scale', String(scale));
        disp.setAttribute('xChannelSelector', 'R');
        disp.setAttribute('yChannelSelector', 'G');

        filter.appendChild(feImage);
        filter.appendChild(disp);
        svg.appendChild(filter);

        var lastW = 0, lastH = 0, raf = 0;

        function update() {
            raf = 0;
            var w = Math.round(el.offsetWidth);
            var h = Math.round(el.offsetHeight);
            if (!w || !h || (w === lastW && h === lastH)) return;
            lastW = w; lastH = h;

            var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2;
            radius = Math.min(radius, h / 2, w / 2);
            var url = buildMap(w, h, radius, Math.min(bezel, h / 2));

            [filter, feImage].forEach(function (n) {
                n.setAttribute('x', '0');
                n.setAttribute('y', '0');
                n.setAttribute('width', String(w));
                n.setAttribute('height', String(h));
            });
            feImage.setAttribute('href', url);
            feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);

            if (isNav) {
                el.classList.add('lg-refract');
            } else {
                var f = 'url(#' + id + ') blur(' + blur + 'px) saturate(170%) brightness(1.03)';
                el.style.webkitBackdropFilter = f;
                el.style.backdropFilter = f;
            }
        }

        function schedule() { if (!raf) raf = requestAnimationFrame(update); }

        // Hidden elements (the blog reader) report 0×0 until shown;
        // the observer fires as soon as they get a size.
        if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(el);
        window.addEventListener('resize', schedule);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
        schedule();
    }

    Array.prototype.forEach.call(targets, setup);
}());
